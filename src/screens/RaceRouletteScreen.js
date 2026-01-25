import React, { useState, useEffect } from 'react';
import { 
  View, 
  StyleSheet, 
  ScrollView, 
  TextInput, 
  Alert,
  useWindowDimensions,
  Image,
  Pressable,
  Text
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import EventCard from '../components/EventCard';
import { generateEventSequence, getDefaultEventPool } from '../lib/randomizer';
import { loadEventAssignments, isEventFullyAssigned, clearAllAssignments } from '../lib/eventAssignments';
import eventBus from '../lib/eventBus';
import { MobileH1, MobileH2, MobileBody, MobileCaption } from '../components/Typography';
import { Card } from '../components/Card';
import { ButtonPrimary, ButtonSecondary } from '../components';
import { styleTokens } from '../theme';
import { scale } from '../utils/scale';
import { useResponsive } from '../utils/useResponsive';

const RaceRouletteScreen = ({ navigation }) => {
  const { width, height } = useWindowDimensions();
  const responsive = useResponsive();
  const isLandscape = width > height;
  
  const [eventPool, setEventPool] = useState(getDefaultEventPool());
  const [totalEvents, setTotalEvents] = useState('5');
  const [numRelays, setNumRelays] = useState('1');
  const [relayPositions, setRelayPositions] = useState('');
  const [eventSequence, setEventSequence] = useState([]);
  const [revealedIndex, setRevealedIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [assignments, setAssignments] = useState([]);
  const [teams, setTeams] = useState([]);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  // Load saved state on component mount
  useEffect(() => {
    loadSavedState();
  }, []);

  // Reload assignments when screen comes into focus
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', async () => {
      const assignmentsData = await loadEventAssignments();
      setAssignments(assignmentsData);
    });

    return unsubscribe;
  }, [navigation]);

  useEffect(() => {
    // Only handle explicit settings updates, don't auto-regenerate on mount
    const unsub = eventBus.on('settings.roulette.updated', async () => {
      try {
        const raw = await AsyncStorage.getItem('settings.roulette');
        if (raw) {
          const cfg = JSON.parse(raw);
          const total = Number(cfg.totalEvents) || 5;
          const relays = typeof cfg.numRelays === 'number' ? cfg.numRelays : 0;
          const positions = Array.isArray(cfg.relayPositions) ? cfg.relayPositions.map(p => p - 1) : [];
          const result = generateEventSequence(eventPool, total, relays, positions);
          if (result.success) {
            // Clear both event results and athlete assignments when settings change
            await AsyncStorage.removeItem('eventResults');
            await clearAllAssignments();
            
            setEventSequence(result.sequence);
            setRevealedIndex(0);
            setAssignments([]);
            await AsyncStorage.setItem('eventSequence', JSON.stringify(result.sequence));
            await AsyncStorage.setItem('revealedIndex', '0');
          }
        }
      } catch {}
    });
    return () => {
      unsub && unsub();
    };
  }, [eventPool]);

  const loadSavedState = async () => {
    try {
      const savedSequence = await AsyncStorage.getItem('eventSequence');
      const savedIndex = await AsyncStorage.getItem('revealedIndex');
      const savedEventPool = await AsyncStorage.getItem('eventPool');
      const savedTeams = await AsyncStorage.getItem('teams');
      
      if (savedSequence) {
        setEventSequence(JSON.parse(savedSequence));
      }
      if (savedIndex) {
        setRevealedIndex(parseInt(savedIndex));
      }
      if (savedEventPool) {
        setEventPool(JSON.parse(savedEventPool));
      }
      if (savedTeams) {
        setTeams(JSON.parse(savedTeams));
      }
      
      // Load assignments
      const assignmentsData = await loadEventAssignments();
      setAssignments(assignmentsData);
      
    } catch (error) {
      console.log('Error loading saved state:', error);
    }
  };

  const saveState = async (sequence, index) => {
    try {
      await AsyncStorage.setItem('eventSequence', JSON.stringify(sequence));
      await AsyncStorage.setItem('revealedIndex', index.toString());
    } catch (error) {
      console.log('Error saving state:', error);
    }
  };

  const generateSequence = async () => {
    try {
      setIsLoading(true);
      
      // Load settings from Settings screen
      const rouletteSettingsRaw = await AsyncStorage.getItem('settings.roulette');
      let total = 5, relays = 1, positions = [];
      
      if (rouletteSettingsRaw) {
        const cfg = JSON.parse(rouletteSettingsRaw);
        total = Number(cfg.totalEvents) || 5;
        relays = typeof cfg.numRelays === 'number' ? cfg.numRelays : 1;
        positions = Array.isArray(cfg.relayPositions) ? cfg.relayPositions.map(p => p - 1) : [];
        
        // Debug logging
        console.log('Settings loaded:', { total, relays, originalPositions: cfg.relayPositions, convertedPositions: positions });
      }
      
      const result = generateEventSequence(eventPool, total, relays, positions);
      
      if (result.success) {
        // Clear both event results and athlete assignments
        await AsyncStorage.removeItem('eventResults');
        await clearAllAssignments();
        
        setEventSequence(result.sequence);
        setRevealedIndex(0);
        await saveState(result.sequence, 0);
        
        // Reload assignments after clearing
        setAssignments([]);
        
        // Debug logging
        console.log('Generated sequence:', result.sequence);
        console.log('Relay positions used:', result.relayPositions);
        console.log('Relay events in sequence:', result.sequence.filter((event, index) => result.relayPositions.includes(index)));
        
        Alert.alert('Success', `New event sequence generated!\n\nRelays: ${relays}\nRelay positions: ${result.relayPositions.map(p => p + 1).join(', ')}\n\nAll previous assignments cleared.`);
      } else {
        Alert.alert('Error', result.error);
      }
      
      setIsLoading(false);
    } catch (error) {
      setIsLoading(false);
      console.error('Generate sequence error:', error);
      Alert.alert('Error', 'Failed to generate sequence. Please check your settings.');
    }
  };

  const revealNextEvent = async () => {
    if (revealedIndex >= eventSequence.length) {
      Alert.alert('Complete!', 'All events have been revealed!');
      return;
    }

    const newIndex = revealedIndex + 1;
    setRevealedIndex(newIndex);
    await saveState(eventSequence, newIndex);
    
    // Reload assignments after reveal
    const assignmentsData = await loadEventAssignments();
    setAssignments(assignmentsData);
  };

  const handleAssignAthletes = (eventIndex, eventName) => {
    if (teams.length === 0) {
      Alert.alert(
        'No Teams Found',
        'Please create teams first in the Assign Teams screen.',
        [
          { text: 'OK' },
          { text: 'Go to Teams', onPress: () => navigation.navigate('AssignTeams') }
        ]
      );
      return;
    }
    
    navigation.navigate('AssignRunners', {
      eventIndex,
      eventName
    });
  };

  const handleEventCardPress = (eventIndex, eventName) => {
    handleAssignAthletes(eventIndex, eventName);
  };

  const resetSequence = () => {
    console.log('Reset button clicked');
    setShowResetConfirm(true);
  };

  const handleResetConfirm = async () => {
    try {
      console.log('Resetting sequence...');
      setShowResetConfirm(false);
      
      // Clear event results and athlete assignments
      await AsyncStorage.removeItem('eventResults');
      await clearAllAssignments();
      
      setEventSequence([]);
      setRevealedIndex(0);
      setAssignments([]);
      await saveState([], 0);
      
      console.log('Reset complete');
    } catch (error) {
      console.error('Error resetting sequence:', error);
      alert('Error: Failed to reset sequence. Please try again.');
    }
  };

  const handleResetCancel = () => {
    console.log('Reset cancelled');
    setShowResetConfirm(false);
  };

  const getNextEvent = () => {
    if (revealedIndex < eventSequence.length) {
      return eventSequence[revealedIndex];
    }
    return null;
  };

  return (
    <View style={styles.container}>
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          responsive.isLargeScreen && styles.scrollContentCentered
        ]}
        showsVerticalScrollIndicator={true}
      >
        {/* Controls removed - sequence comes from Settings */}

        {/* No Sequence Section */}
        {eventSequence.length === 0 && (
          <Card style={[styles.revealSection, isLandscape && styles.revealSectionLandscape]}>
            <MobileH2 style={[
              styles.sectionTitle, 
              isLandscape && styles.sectionTitleLandscape,
              width < 400 && styles.sectionTitleSmall,
              width < 350 && styles.sectionTitleTiny
            ]}>
              Race Roulette Randomizer
            </MobileH2>
            
            {/* Digital Screen showing no sequence */}
            <View style={styles.digitalScreenContainer}>
              <View style={styles.digitalScreen}>
                <View style={styles.cornerTL} />
                <View style={styles.cornerTR} />
                <View style={styles.cornerBL} />
                <View style={styles.cornerBR} />
                
                <View style={styles.screenContent}>
                  <View style={styles.screenHeader}>
                    <View style={styles.logoContainer}>
                      <Image source={require('../../Images/minimal_logo.png')} style={styles.logoImage} />
                    </View>
                    <Text style={styles.raceControlText}>RACE CONTROL</Text>
                  </View>
                  
                  <View style={styles.mainDisplay}>
                    <Text style={styles.mainTitle}>VELOX 1</Text>
                  </View>
                  
                  <View style={styles.screenFooter}>
                    <Text style={styles.versionText}>VELOX-1.0</Text>
                  </View>
                </View>
              </View>
              
              {/* Generate Button */}
              <ButtonPrimary 
                style={styles.generateButton}
                onPress={generateSequence}
                disabled={isLoading}
              >
                {isLoading ? 'Generating...' : 'Generate New Sequence'}
              </ButtonPrimary>
            </View>

            <View style={styles.progressInfo}>
              <MobileCaption style={styles.progressText}>
                Configure settings then generate a sequence to begin
              </MobileCaption>
            </View>
          </Card>
        )}

        {/* Reveal Section */}
        {eventSequence.length > 0 && (
          <Card style={[styles.revealSection, isLandscape && styles.revealSectionLandscape]}>
            <MobileH2 style={[
              styles.sectionTitle, 
              isLandscape && styles.sectionTitleLandscape,
              width < 400 && styles.sectionTitleSmall,
              width < 350 && styles.sectionTitleTiny
            ]}>
              Race Roulette Randomizer
            </MobileH2>
            
            {/* Futuristic Digital Screen Simulator */}
            <View style={styles.digitalScreenContainer}>
              {/* Main Digital Screen */}
              <View style={styles.digitalScreen}>
                {/* Corner Mounting Brackets */}
                <View style={styles.cornerTL} />
                <View style={styles.cornerTR} />
                <View style={styles.cornerBL} />
                <View style={styles.cornerBR} />
                
                {/* Circuit Pattern Background */}
                <View style={styles.circuitPattern} />
                
                {/* Scan Line Effect */}
                <View style={styles.scanLine} />
                
                {/* Screen Content */}
                <View style={styles.screenContent}>
                  {/* Header */}
                  <View style={styles.screenHeader}>
                    <View style={styles.logoContainer}>
                      <Image source={require('../../Images/minimal_logo.png')} style={styles.logoImage} />
                    </View>
                    <Text style={styles.raceControlText}>RACE CONTROL</Text>
                  </View>
                  
                  {/* Main Display */}
                  <View style={styles.mainDisplay}>
                    <Text style={styles.mainTitle}>
                      {revealedIndex > 0 ? eventSequence[revealedIndex - 1] : 'VELOX 1'}
                    </Text>
                    
                    {revealedIndex > 0 && (
                      <Text style={styles.eventNumber}>
                        Event #{revealedIndex}
                      </Text>
                    )}
                  </View>
                  
                  {/* Footer */}
                  <View style={styles.screenFooter}>
                    <Text style={styles.versionText}>VELOX-1.0</Text>
                  </View>
                </View>
              </View>
              
              {/* Reveal Button */}
              {eventSequence.length > 0 && revealedIndex < eventSequence.length && (
                <Pressable 
                  style={styles.revealButton}
                  onPress={revealNextEvent}
                >
                  <Text style={styles.revealButtonText}>REVEAL EVENT</Text>
                </Pressable>
              )}
              
              {/* Assign Athletes Button */}
              {revealedIndex > 0 && (
                <View style={styles.assignmentSection}>
                  <MobileCaption style={styles.assignmentLabel}>
                    Current Event: {eventSequence[revealedIndex - 1]}
                  </MobileCaption>
                  <ButtonPrimary 
                    style={styles.assignButton}
                    onPress={() => handleAssignAthletes(revealedIndex - 1, eventSequence[revealedIndex - 1])}
                  >
                    {isEventFullyAssigned(assignments, revealedIndex - 1, teams) ? 'Edit Athletes' : 'Assign Athletes'}
                  </ButtonPrimary>
                </View>
              )}
            </View>

            <View style={styles.progressInfo}>
              <MobileCaption style={styles.progressText}>
                {revealedIndex} of {eventSequence.length} events revealed
              </MobileCaption>
            </View>
          </Card>
        )}

        {/* Event Sequence Display */}
        {eventSequence.length > 0 && (
          <Card style={[styles.sequenceSection, isLandscape && styles.sequenceSectionLandscape]}>
            <View style={[styles.sequenceHeader, isLandscape && styles.sequenceHeaderLandscape]}>
              <MobileH2 style={[
                styles.sectionTitle, 
                isLandscape && styles.sectionTitleLandscape,
                width < 400 && styles.sectionTitleSmall,
                width < 350 && styles.sectionTitleTiny
              ]}>
                Event Sequence
              </MobileH2>
              <Pressable 
                style={styles.resetButton}
                onPress={() => {
                  console.log('Reset button pressed!');
                  resetSequence();
                }}
              >
                <Text style={styles.resetButtonText}>Reset</Text>
              </Pressable>
            </View>
            
            <View style={[styles.sequenceGrid, isLandscape && styles.sequenceGridLandscape]}>
              {eventSequence.map((event, index) => (
                <EventCard
                  key={index}
                  event={event}
                  index={index}
                  isRevealed={index < revealedIndex}
                  isNext={index === revealedIndex}
                  isAssigned={isEventFullyAssigned(assignments, index, teams)}
                  onPress={handleEventCardPress}
                />
              ))}
            </View>
          </Card>
        )}
      </ScrollView>

      {/* Reset Confirmation Modal */}
      {showResetConfirm && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <MobileH2 style={styles.modalTitle}>Reset Sequence</MobileH2>
            <MobileBody style={styles.modalMessage}>
              This will clear the current event sequence, all recorded scores, and all athlete assignments. You can then generate a new sequence.
            </MobileBody>
            <View style={styles.modalButtons}>
              <Pressable style={styles.modalButtonCancel} onPress={handleResetCancel}>
                <Text style={styles.modalButtonTextCancel}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.modalButtonConfirm} onPress={handleResetConfirm}>
                <Text style={styles.modalButtonTextConfirm}>Reset</Text>
              </Pressable>
            </View>
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: styleTokens.colors.background,
    overflow: 'hidden',
  },
  scrollView: {
    flex: 1,
    overflow: 'scroll',
  },
  scrollContent: {
    padding: scale(24),
  },
  scrollContentCentered: {
    alignItems: 'center',
  },
  controlsSection: {
    marginBottom: scale(24),
    padding: scale(20),
    minHeight: scale(120),
    maxWidth: '100%', // Prevents section from extending beyond screen
  },
  controlsSectionLandscape: {
    flexDirection: 'column',
    alignItems: 'stretch',
    padding: scale(24), // More padding for landscape
  },
  controlsContent: {
    flex: 1,
  },
  controlsContentLandscape: {
    flexDirection: 'column',
    alignItems: 'stretch',
  },
  inputsContainer: {
    flexDirection: 'column',
    width: '100%',
  },
  inputsContainerLandscape: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: scale(24),
    marginBottom: scale(16),
    width: '100%',
  },
  sectionTitle: {
    color: styleTokens.colors.textPrimary,
    marginBottom: scale(20),
    textAlign: 'center',
    fontSize: scale(18), // Even smaller for portrait to ensure fit
    lineHeight: scale(22),
    flexShrink: 1, // Allow text to shrink if needed
    flexWrap: 'wrap', // Enable text wrapping
    paddingHorizontal: scale(8), // Add horizontal padding to prevent edge clipping
  },
  sectionTitleLandscape: {
    fontSize: scale(24), // Larger size for landscape
    lineHeight: scale(28),
    paddingHorizontal: scale(12), // More padding for landscape
  },
  sectionTitleSmall: {
    fontSize: scale(16), // Smaller font size for very small screens
    lineHeight: scale(20),
    paddingHorizontal: scale(4), // Less padding for small screens
  },
  sectionTitleTiny: {
    fontSize: scale(14), // Even smaller font size for extremely narrow screens
    lineHeight: scale(18),
    paddingHorizontal: scale(2), // Less padding for tiny screens
  },
  inputGroup: {
    marginBottom: scale(16),
    flex: 1,
    minWidth: 0, // Prevents flex items from overflowing
  },
  label: {
    color: styleTokens.colors.textSecondary,
    marginBottom: scale(8),
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderColor: styleTokens.colors.border,
    borderRadius: styleTokens.components.input.borderRadius,
    padding: scale(12),
    backgroundColor: styleTokens.components.input.backgroundColor,
    color: styleTokens.colors.textPrimary,
    fontSize: scale(16),
    minHeight: scale(48),
    flex: 1,
    minWidth: 0, // Prevents flex items from overflowing
  },
  helpText: {
    color: styleTokens.colors.textSecondary,
    fontSize: scale(11), // Smaller base font size for portrait
    marginTop: scale(4),
    opacity: 0.7,
    textAlign: 'center',
    flexShrink: 1,
    flexWrap: 'wrap',
    paddingHorizontal: scale(2), // Reduced padding for portrait
    lineHeight: scale(14), // Tighter line height for portrait
  },
  helpTextLandscape: {
    fontSize: scale(14),
    paddingHorizontal: scale(8),
    lineHeight: scale(18), // More comfortable line height for landscape
  },
  helpTextSmall: {
    fontSize: scale(10), // Even smaller for very small screens
    paddingHorizontal: scale(1),
    lineHeight: scale(12),
  },
  helpTextTiny: {
    fontSize: scale(9), // Tiny font for extremely narrow screens
    paddingHorizontal: scale(0),
    lineHeight: scale(11),
  },
  generateButton: {
    marginTop: scale(16),
    alignSelf: 'center',
    minWidth: scale(200),
    maxWidth: '100%', // Prevents button from extending beyond container
  },
  revealSection: {
    marginBottom: scale(24),
    padding: scale(20),
    minHeight: scale(120),
  },
  revealSectionLandscape: {
    padding: scale(24), // More padding for landscape
    marginBottom: scale(24),
  },
  digitalScreenContainer: {
    alignItems: 'center',
    marginBottom: scale(16),
  },
  digitalScreen: {
    width: scale(320),
    height: scale(200),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#45A196',
    borderRadius: scale(20),
    borderWidth: scale(8),
    borderColor: 'rgba(100, 226, 211, 0.8)',
    shadowColor: 'rgba(100, 226, 211, 0.9)',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: scale(25),
    elevation: 8,
    overflow: 'hidden',
    position: 'relative',
  },
  screenContent: {
    width: '100%',
    height: '100%',
    padding: scale(20),
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    borderRadius: scale(12),
    // Add subtle digital screen texture
    borderWidth: 1,
    borderColor: 'rgba(100, 226, 211, 0.2)',
    shadowColor: 'rgba(0, 0, 0, 0.8)',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: scale(8),
    elevation: 4,
  },
  screenHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: scale(16),
    paddingBottom: scale(12),
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(100, 226, 211, 0.3)',
    width: '100%',
    justifyContent: 'space-between',
  },
  logoContainer: {
    width: scale(40),
    height: scale(40),
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'contain', // Ensure the logo fits properly within the container
  },
  raceControlText: {
    color: 'rgba(100, 226, 211, 0.9)',
    fontSize: scale(8), // Match website font size
    fontWeight: 'bold',
    letterSpacing: scale(1.2),
    fontFamily: styleTokens.typography.fonts.roboto || 'System',
  },
  mainDisplay: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    width: '100%',
  },
  mainTitle: {
    color: '#64E2D3',
    marginBottom: scale(8),
    textAlign: 'center',
    fontSize: scale(28),
    fontWeight: 'bold',
    letterSpacing: scale(2),
    fontFamily: styleTokens.typography.fonts.roboto || 'System',
  },
  eventNumber: {
    color: '#64E2D3',
    fontSize: scale(16),
    fontWeight: 'bold',
    textAlign: 'center',
    letterSpacing: scale(1),
    fontFamily: styleTokens.typography.fonts.roboto || 'System',
  },
  screenFooter: {
    marginTop: scale(16),
    paddingTop: scale(12),
    borderTopWidth: 1,
    borderTopColor: 'rgba(100, 226, 211, 0.3)',
    width: '100%',
    alignItems: 'center',
  },
  versionText: {
    color: 'rgba(100, 226, 211, 0.8)',
    fontSize: scale(8), // Match website font size
    fontWeight: 'bold',
    letterSpacing: scale(0.8),
    fontFamily: styleTokens.typography.fonts.roboto || 'System',
  },
  revealButton: {
    minWidth: scale(160),
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    borderWidth: scale(3),
    borderColor: '#64E2D3',
    borderRadius: scale(12),
    shadowColor: 'rgba(100, 226, 211, 0.6)',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius: scale(6),
    elevation: 6,
    marginTop: scale(16),
    paddingVertical: scale(16),
    paddingHorizontal: scale(32),
    alignItems: 'center',
    justifyContent: 'center',
  },
  revealButtonText: {
    color: '#64E2D3',
    fontSize: scale(16),
    fontWeight: 'bold',
    letterSpacing: scale(1),
    fontFamily: styleTokens.typography.fonts.roboto || 'System',
  },
  generateButton: {
    marginTop: scale(16),
    minWidth: scale(200),
  },
  assignmentSection: {
    marginTop: scale(16),
    alignItems: 'center',
    gap: scale(8),
  },
  assignmentLabel: {
    color: styleTokens.colors.textSecondary,
    textAlign: 'center',
  },
  assignButton: {
    minWidth: scale(160),
  },
  progressInfo: {
    alignItems: 'center',
  },
  progressText: {
    color: styleTokens.colors.textSecondary,
    opacity: 0.8,
  },
  sequenceSection: {
    marginBottom: scale(24),
    padding: scale(20),
    minHeight: scale(120),
  },
  sequenceSectionLandscape: {
    padding: scale(24), // More padding for landscape
    marginBottom: scale(24),
  },
  sequenceGrid: {
    flexDirection: 'column',
    gap: scale(16),
  },
  sequenceGridLandscape: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: scale(16),
  },
  sequenceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: scale(20),
    flexWrap: 'wrap', // Allow wrapping in portrait mode
    gap: scale(12), // Add gap between title and button
  },
  sequenceHeaderLandscape: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: scale(20),
    gap: scale(16), // Larger gap for landscape
  },
  resetButton: {
    minWidth: scale(80),
    backgroundColor: styleTokens.colors.primaryDark,
    paddingVertical: scale(12),
    paddingHorizontal: scale(20),
    borderRadius: scale(8),
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: scale(48),
  },
  resetButtonText: {
    color: styleTokens.colors.white,
    fontSize: scale(14),
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: scale(1),
    fontFamily: styleTokens.typography.fonts.roboto || 'System',
  },
  relayPositionsGroup: {
    marginBottom: scale(16),
    width: '100%',
    alignItems: 'stretch',
    paddingHorizontal: scale(2), // Add small padding for portrait
  },
  relayPositionsGroupLandscape: {
    width: '100%',
    marginBottom: scale(16),
    alignItems: 'stretch',
    paddingHorizontal: scale(4),
  },
  cornerTL: {
    position: 'absolute',
    top: scale(8),
    left: scale(8),
    width: scale(6),
    height: scale(6),
    backgroundColor: '#444',
    borderRadius: scale(3),
    zIndex: 4,
    shadowColor: 'rgba(0, 0, 0, 0.5)',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.5,
    shadowRadius: scale(2),
    elevation: 2,
  },
  cornerTR: {
    position: 'absolute',
    top: scale(8),
    right: scale(8),
    width: scale(6),
    height: scale(6),
    backgroundColor: '#444',
    borderRadius: scale(3),
    zIndex: 4,
    shadowColor: 'rgba(0, 0, 0, 0.5)',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.5,
    shadowRadius: scale(2),
    elevation: 2,
  },
  cornerBL: {
    position: 'absolute',
    bottom: scale(8),
    left: scale(8),
    width: scale(6),
    height: scale(6),
    backgroundColor: '#444',
    borderRadius: scale(3),
    zIndex: 4,
    shadowColor: 'rgba(0, 0, 0, 0.5)',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.5,
    shadowRadius: scale(2),
    elevation: 2,
  },
  cornerBR: {
    position: 'absolute',
    bottom: scale(8),
    right: scale(8),
    width: scale(6),
    height: scale(6),
    backgroundColor: '#444',
    borderRadius: scale(3),
    zIndex: 4,
    shadowColor: 'rgba(0, 0, 0, 0.5)',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.5,
    shadowRadius: scale(2),
    elevation: 2,
  },
  circuitPattern: {
    position: 'absolute',
    top: scale(16),
    left: scale(16),
    right: scale(16),
    bottom: scale(16),
    backgroundColor: 'transparent',
    borderRadius: scale(8),
    opacity: 0.3,
    zIndex: 1,
    // Create a more realistic circuit pattern
    borderWidth: 1,
    borderColor: 'rgba(100, 226, 211, 0.2)',
    borderStyle: 'dashed',
  },
  scanLine: {
    position: 'absolute',
    top: scale(16),
    left: scale(16),
    right: scale(16),
    height: scale(2),
    backgroundColor: 'rgba(100, 226, 211, 0.4)',
    zIndex: 5,
    borderRadius: scale(12),
    shadowColor: 'rgba(100, 226, 211, 0.8)',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: scale(4),
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  modalContent: {
    backgroundColor: styleTokens.colors.surface,
    borderRadius: scale(12),
    padding: scale(24),
    width: '90%',
    maxWidth: scale(400),
    ...styleTokens.shadows.lg,
  },
  modalTitle: {
    color: styleTokens.colors.textPrimary,
    marginBottom: scale(16),
    textAlign: 'center',
  },
  modalMessage: {
    color: styleTokens.colors.textSecondary,
    marginBottom: scale(24),
    textAlign: 'center',
    lineHeight: scale(20),
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: scale(12),
  },
  modalButtonCancel: {
    flex: 1,
    backgroundColor: styleTokens.colors.border,
    paddingVertical: scale(12),
    paddingHorizontal: scale(20),
    borderRadius: scale(8),
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: scale(48),
  },
  modalButtonConfirm: {
    flex: 1,
    backgroundColor: styleTokens.colors.error || '#e74c3c',
    paddingVertical: scale(12),
    paddingHorizontal: scale(20),
    borderRadius: scale(8),
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: scale(48),
  },
  modalButtonTextCancel: {
    color: styleTokens.colors.textPrimary,
    fontSize: scale(16),
    fontWeight: '600',
  },
  modalButtonTextConfirm: {
    color: styleTokens.colors.white,
    fontSize: scale(16),
    fontWeight: '600',
  },
});

export default RaceRouletteScreen; 