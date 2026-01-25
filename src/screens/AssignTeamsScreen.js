import React, { useState, useEffect } from 'react';
import { 
  View, 
  StyleSheet, 
  ScrollView, 
  Alert,
  Pressable,
  Modal,
  Text
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import eventBus from '../lib/eventBus';
import TeamList from '../components/TeamList';
import { assignTeams, moveAthlete, getTeamColors, getColorName } from '../lib/assigner';
import { MobileH1, MobileH2, MobileBody, MobileCaption } from '../components/Typography';
import { Card } from '../components/Card';
import { ButtonPrimary, ButtonSecondary, Input } from '../components';
import { styleTokens } from '../theme';
import { scale } from '../utils/scale';

const AssignTeamsScreen = () => {
  const [athletes, setAthletes] = useState([]);
  const [teams, setTeams] = useState([]);
  const [numTeams, setNumTeams] = useState('4');
  const [showTeamSize, setShowTeamSize] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [hasResults, setHasResults] = useState(false);
  const [showTeamEditor, setShowTeamEditor] = useState(false);
  const [selectedTeamForEdit, setSelectedTeamForEdit] = useState(null);
  const [editedTeamName, setEditedTeamName] = useState('');
  const [editedTeamColor, setEditedTeamColor] = useState('');
  const [availableColors] = useState(getTeamColors());
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  // Load saved data on component mount
  useEffect(() => {
    loadData();
    // Subscribe to planned team count updates
    const handlePlanned = (planned) => {
      setNumTeams(String(planned));
    };
    eventBus.on('plannedTeamsUpdated', handlePlanned);
    return () => {
      eventBus.off('plannedTeamsUpdated', handlePlanned);
    };
  }, []);

  const loadData = async () => {
    try {
      const savedAthletes = await AsyncStorage.getItem('athletes');
      const savedTeams = await AsyncStorage.getItem('teams');
      const savedResults = await AsyncStorage.getItem('eventResults');
      const teamConfigRaw = await AsyncStorage.getItem('settings.teamConfig');
      
      if (savedAthletes) {
        setAthletes(JSON.parse(savedAthletes));
      }
      if (savedTeams) {
        setTeams(JSON.parse(savedTeams));
      }
      if (savedResults) {
        const arr = JSON.parse(savedResults);
        setHasResults(Array.isArray(arr) && arr.length > 0);
      }
      if (teamConfigRaw) {
        try {
          const cfg = JSON.parse(teamConfigRaw);
          if (cfg && typeof cfg.plannedTeams === 'number' && cfg.plannedTeams > 0) {
            setNumTeams(String(cfg.plannedTeams));
          }
        } catch {}
      }
    } catch (error) {
      console.log('Error loading data:', error);
    }
  };

  const handleNumTeamsChange = async (value) => {
    if (hasResults) {
      Alert.alert(
        'Team Count Locked',
        'Existing results detected. Changing team count is blocked to prevent scoring inconsistencies. You can hard reset results to proceed.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Hard Reset Results',
            style: 'destructive',
            onPress: async () => {
              try {
                await AsyncStorage.removeItem('eventResults');
                setHasResults(false);
                setNumTeams(value);
                const planned = parseInt(value || '0');
                if (!isNaN(planned) && planned > 0) {
                  eventBus.emit('plannedTeamsUpdated', planned);
                }
              } catch (e) {
                Alert.alert('Error', 'Failed to reset results.');
              }
            }
          }
        ]
      );
      return;
    }
    setNumTeams(value);
    const planned = parseInt(value || '0');
    if (!isNaN(planned) && planned > 0) {
      eventBus.emit('plannedTeamsUpdated', planned);
    }
  };

  const saveTeams = async (newTeams) => {
    try {
      await AsyncStorage.setItem('teams', JSON.stringify(newTeams));
      // Notify other screens (e.g., Settings) about team count changes
      eventBus.emit('teamsUpdated', Array.isArray(newTeams) ? newTeams.length : 0);
    } catch (error) {
      console.log('Error saving teams:', error);
    }
  };

  const generateTeams = () => {
    if (athletes.length === 0) {
      Alert.alert('No Athletes', 'Please add athletes first in the Team Builder screen.');
      return;
    }

    const num = parseInt(numTeams);
    if (num < 1) {
      Alert.alert('Invalid Input', 'Number of teams must be at least 1.');
      return;
    }

    if (num > athletes.length) {
      Alert.alert('Too Many Teams', `Cannot create ${num} teams with only ${athletes.length} athletes.`);
      return;
    }

    const result = assignTeams(athletes, num);
    
    if (result.success) {
      setTeams(result.teams);
      saveTeams(result.teams);
      eventBus.emit('teamsUpdated', result.teams.length);
      
      Alert.alert(
        'Teams Generated!', 
        `Created ${result.teams.length} teams with ${result.stats.totalAthletes} athletes.\n\n` +
        `High Tier: ${result.stats.highTier}\n` +
        `Medium Tier: ${result.stats.medTier}\n` +
        `Low Tier: ${result.stats.lowTier}\n\n` +
        `Average team size: ${result.stats.averageTeamSize}`
      );
    } else {
      Alert.alert('Error', result.error);
    }
  };

  const handleMoveAthlete = (athleteId, fromTeamId, toTeamId) => {
    const result = moveAthlete([...teams], athleteId, fromTeamId, toTeamId);
    
    if (result.success) {
      setTeams(result.teams);
      saveTeams(result.teams);
    } else {
      Alert.alert('Error', result.error);
    }
  };

  const openTeamEditor = (team) => {
    setSelectedTeamForEdit(team);
    setEditedTeamName(team.name);
    setEditedTeamColor(team.color);
    setShowTeamEditor(true);
  };

  const saveTeamChanges = async () => {
    if (!selectedTeamForEdit || !editedTeamName.trim()) {
      Alert.alert('Error', 'Team name cannot be empty');
      return;
    }

    // Check if name is already used by another team
    const nameExists = teams.some(team => 
      team.id !== selectedTeamForEdit.id && 
      team.name.toLowerCase() === editedTeamName.trim().toLowerCase()
    );

    if (nameExists) {
      Alert.alert('Error', 'A team with this name already exists');
      return;
    }

    const updatedTeams = teams.map(team => 
      team.id === selectedTeamForEdit.id 
        ? { ...team, name: editedTeamName.trim(), color: editedTeamColor }
        : team
    );

    setTeams(updatedTeams);
    saveTeams(updatedTeams);
    setShowTeamEditor(false);
    setSelectedTeamForEdit(null);
  };

  const selectTeamColor = (color) => {
    setEditedTeamColor(color);
  };

  const getUsedColors = () => {
    return teams.map(team => team.color).filter(Boolean);
  };

  const resetTeams = () => {
    console.log('Reset teams clicked');
    setShowResetConfirm(true);
  };

  const handleResetConfirm = () => {
    console.log('Confirming reset teams');
    setTeams([]);
    saveTeams([]);
    eventBus.emit('teamsUpdated', 0);
    setShowResetConfirm(false);
  };

  const handleResetCancel = () => {
    console.log('Reset teams cancelled');
    setShowResetConfirm(false);
  };

  const getTeamSize = () => {
    if (athletes.length === 0 || teams.length === 0) return 0;
    return Math.ceil(athletes.length / teams.length);
  };

  const plannedTeamsCount = parseInt(numTeams || '0');
  const isPlannedTeamsValid = !isNaN(plannedTeamsCount) && plannedTeamsCount > 0;

  return (
    <View style={styles.container}>
      <ScrollView 
        style={styles.scrollView} 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={true}
      >
        {/* Controls Section */}
        <Card style={styles.sectionCard} variant="primary">
          <MobileH2 style={styles.sectionTitle}>Generate Teams</MobileH2>

          <View style={styles.inputRow}>
            <View style={styles.inputGroupHalf}>
              <MobileBody style={styles.teamSizeLabel}>Planned Teams</MobileBody>
              <MobileCaption style={styles.teamSizeValue}>{Number(numTeams) || 0} (from Settings)</MobileCaption>
            </View>
            <View style={[styles.inputGroupHalf, styles.teamSizeGroup]}>
              <MobileBody style={styles.teamSizeLabel}>Team Size</MobileBody>
              <MobileCaption style={styles.teamSizeValue}>~{getTeamSize()} athletes</MobileCaption>
            </View>
          </View>

          <View style={styles.infoRow}>
            <MobileCaption style={styles.infoText}>Available Athletes: {athletes.length}</MobileCaption>
            <MobileCaption style={styles.infoText}>Current Teams: {teams.length}</MobileCaption>
          </View>

          <ButtonPrimary 
            onPress={generateTeams}
            disabled={athletes.length === 0 || !isPlannedTeamsValid}
            style={styles.generateButton}
          >
            Generate Teams
          </ButtonPrimary>
          {!isPlannedTeamsValid && (
            <MobileCaption style={styles.plannedHint}>Set planned team count in Settings → Team Configuration</MobileCaption>
          )}

          {teams.length > 0 && (
            <View style={styles.postGenButtons}>
              <ButtonSecondary 
                onPress={() => setIsEditMode(!isEditMode)}
                style={styles.resetButton}
              >
                {isEditMode ? 'Disable Edit Mode' : 'Enable Edit Mode'}
              </ButtonSecondary>
              <ButtonSecondary 
                onPress={resetTeams}
                style={styles.resetButton}
              >
                Reset Teams
              </ButtonSecondary>
            </View>
          )}
        </Card>

        {/* Teams Display */}
        {teams.length > 0 && (
          <Card style={styles.teamsSection}>
            <MobileH2 style={styles.sectionTitle}>Team Assignments</MobileH2>
            <TeamList 
              teams={teams} 
              onMoveAthlete={handleMoveAthlete} 
              onColorChange={openTeamEditor}
              editable={isEditMode} 
            />
          </Card>
        )}

        {/* Instructions */}
        {teams.length === 0 && (
          <Card style={styles.instructionsSection}>
            <MobileH2 style={styles.sectionTitle}>How Team Assignment Works</MobileH2>
            <View style={styles.instructionItem}>
              <MobileCaption style={styles.instructionNumber}>1</MobileCaption>
              <MobileBody style={styles.instructionText}>
                Add athletes in the Team Builder screen with their tier (High/Med/Low)
              </MobileBody>
            </View>
            <View style={styles.instructionItem}>
              <MobileCaption style={styles.instructionNumber}>2</MobileCaption>
              <MobileBody style={styles.instructionText}>
                Choose the number of teams you want to create
              </MobileBody>
            </View>
            <View style={styles.instructionItem}>
              <MobileCaption style={styles.instructionNumber}>3</MobileCaption>
              <MobileBody style={styles.instructionText}>
                Click "Generate Teams" to automatically assign athletes using tier-balanced distribution
              </MobileBody>
            </View>
            <View style={styles.instructionItem}>
              <MobileCaption style={styles.instructionNumber}>4</MobileCaption>
              <MobileBody style={styles.instructionText}>
                Athletes are distributed in round-robin fashion: High → Med → Low
              </MobileBody>
            </View>
          </Card>
        )}

        {/* Athlete Summary */}
        {athletes.length > 0 && (
          <Card style={styles.summarySection}>
            <MobileH2 style={styles.sectionTitle}>Athlete Summary</MobileH2>
            <View style={styles.tierBreakdown}>
              <View style={styles.tierRow}>
                <View style={[styles.tierBadge, styles.tierHigh]}>
                  <MobileCaption style={styles.tierText}>High</MobileCaption>
                </View>
                <MobileBody style={styles.tierCount}>
                  {athletes.filter(a => a.tier === 'High').length} athletes
                </MobileBody>
              </View>
              <View style={styles.tierRow}>
                <View style={[styles.tierBadge, styles.tierMed]}>
                  <MobileCaption style={styles.tierText}>Med</MobileCaption>
                </View>
                <MobileBody style={styles.tierCount}>
                  {athletes.filter(a => a.tier === 'Med').length} athletes
                </MobileBody>
              </View>
              <View style={styles.tierRow}>
                <View style={[styles.tierBadge, styles.tierLow]}>
                  <MobileCaption style={styles.tierText}>Low</MobileCaption>
                </View>
                <MobileBody style={styles.tierCount}>
                  {athletes.filter(a => a.tier === 'Low').length} athletes
                </MobileBody>
              </View>
            </View>
          </Card>
        )}
      </ScrollView>

      {/* Color Picker Modal */}
      <Modal
        visible={showTeamEditor}
        animationType="slide"
        transparent
        onRequestClose={() => setShowTeamEditor(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContent}>
            <MobileH2 style={styles.modalTitle}>
              Edit Team
            </MobileH2>
            
            {/* Team Name Section */}
            <View style={styles.editSection}>
              <MobileBody style={styles.sectionLabel}>Team Name</MobileBody>
              <Input
                value={editedTeamName}
                onChangeText={setEditedTeamName}
                placeholder="Enter team name"
                style={styles.teamNameInput}
              />
            </View>

            {/* Team Color Section */}
            <View style={styles.editSection}>
              <MobileBody style={styles.sectionLabel}>Team Color</MobileBody>
              <ScrollView style={styles.colorListContainer} showsVerticalScrollIndicator={false}>
                {availableColors.map((color, index) => {
                  const usedColors = getUsedColors();
                  const isUsed = usedColors.includes(color) && selectedTeamForEdit?.color !== color;
                  const isSelected = editedTeamColor === color;
                  const colorName = getColorName(color);
                  
                  return (
                    <Pressable
                      key={index}
                      style={[
                        styles.colorListItem,
                        isSelected && styles.colorListItemSelected,
                        isUsed && styles.colorListItemDisabled
                      ]}
                      onPress={() => !isUsed && selectTeamColor(color)}
                      disabled={isUsed}
                    >
                      <View style={styles.colorListItemContent}>
                        <View style={[styles.colorPreview, { backgroundColor: color }]} />
                        <MobileBody style={[
                          styles.colorName,
                          isSelected && styles.colorNameSelected,
                          isUsed && styles.colorNameDisabled
                        ]}>
                          {colorName}
                        </MobileBody>
                        {isSelected && (
                          <MobileBody style={styles.selectedIndicator}>✓</MobileBody>
                        )}
                        {isUsed && (
                          <MobileCaption style={styles.usedIndicator}>In Use</MobileCaption>
                        )}
                      </View>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
            
            <View style={styles.modalButtons}>
              <View style={styles.modalButton}>
                <ButtonSecondary 
                  style={styles.modalButtonStyle} 
                  textStyle={styles.modalButtonText}
                  onPress={() => setShowTeamEditor(false)}
                >
                  Cancel
                </ButtonSecondary>
              </View>
              <View style={styles.modalButton}>
                <ButtonPrimary 
                  style={styles.modalButtonStyle}
                  textStyle={styles.modalButtonText}
                  onPress={saveTeamChanges}
                >
                  Save
                </ButtonPrimary>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* Reset Teams Confirmation Modal */}
      {showResetConfirm && (
        <View style={styles.resetModalOverlay}>
          <View style={styles.resetModalContent}>
            <MobileH2 style={styles.resetModalTitle}>Reset Teams</MobileH2>
            <MobileBody style={styles.resetModalMessage}>
              Are you sure you want to reset all teams? This action cannot be undone.
            </MobileBody>
            <View style={styles.resetModalButtons}>
              <Pressable style={styles.resetModalButtonCancel} onPress={handleResetCancel}>
                <Text style={styles.resetModalButtonTextCancel}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.resetModalButtonConfirm} onPress={handleResetConfirm}>
                <Text style={styles.resetModalButtonTextConfirm}>Reset</Text>
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
    paddingBottom: scale(40),
    gap: scale(16),
  },
  sectionCard: {
    padding: scale(20),
    borderRadius: scale(12),
    shadowColor: styleTokens.colors.shadow,
    shadowOffset: { width: 0, height: scale(4) },
    shadowOpacity: 0.15,
    shadowRadius: scale(8),
    elevation: 3,
    marginBottom: scale(16),
  },
  sectionTitle: {
    color: styleTokens.colors.textPrimary,
    marginBottom: scale(16),
    textAlign: 'center',
  },
  generateButton: {
    alignSelf: 'center',
    width: '100%',
    maxWidth: scale(300),
    minWidth: scale(250),
    marginTop: scale(8),
    marginBottom: scale(12),
  },
  inputRow: {
    flexDirection: 'row',
    gap: scale(12),
    marginBottom: scale(16),
    flexWrap: 'wrap',
  },
  inputGroup: {
    flex: 1,
  },
  inputGroupHalf: {
    flexGrow: 1,
    flexBasis: '48%',
    minWidth: scale(160),
  },
  teamSizeGroup: {
    minWidth: scale(140),
  },
  teamSizeLabel: {
    color: styleTokens.colors.textSecondary,
    marginBottom: scale(8),
    flexWrap: 'wrap',
    fontWeight: '600',
  },
  teamSizeValue: {
    color: styleTokens.colors.textPrimary,
    flexShrink: 1,
  },
  teamSizeText: {
    fontSize: 16,
    color: styleTokens.colors.textSecondary,
    textAlign: 'center',
    paddingVertical: scale(12),
    backgroundColor: styleTokens.colors.surface,
    borderRadius: scale(8),
    borderWidth: 1,
    borderColor: styleTokens.colors.border,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: scale(16),
    flexWrap: 'wrap',
    gap: scale(8),
  },
  infoText: {
    color: styleTokens.colors.textSecondary,
  },
  postGenButtons: {
    width: '100%',
    alignItems: 'center',
    gap: scale(12),
    marginTop: scale(4),
  },
  resetButton: {
    width: '100%',
    maxWidth: scale(300),
    minWidth: scale(250),
  },
  plannedHint: {
    color: styleTokens.colors.textSecondary,
    textAlign: 'center',
    marginTop: scale(6),
  },
  teamsSection: {
    padding: scale(20),
    borderRadius: scale(12),
    ...styleTokens.shadows.md,
    marginBottom: scale(16),
  },
  instructionsSection: {
    padding: scale(20),
    borderRadius: scale(12),
    ...styleTokens.shadows.sm,
    marginBottom: scale(16),
  },
  instructionsTitle: {
    color: styleTokens.colors.textPrimary,
    marginBottom: scale(16),
    textAlign: 'left',
  },
  instructionItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: scale(12),
  },
  instructionNumber: {
    backgroundColor: styleTokens.colors.primary,
    color: styleTokens.colors.white,
    width: scale(24),
    height: scale(24),
    borderRadius: scale(12),
    textAlign: 'center',
    lineHeight: scale(24),
    fontSize: scale(14),
    fontWeight: 'bold',
    marginRight: scale(12),
    marginTop: scale(2),
  },
  instructionText: {
    color: styleTokens.colors.textSecondary,
    flex: 1,
    lineHeight: scale(20),
  },
  summarySection: {
    margin: scale(16),
    padding: scale(20),
    minHeight: scale(120),
  },
  tierBreakdown: {
    gap: scale(12),
  },
  tierRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: scale(12),
    backgroundColor: styleTokens.components.card.backgroundColor,
    borderRadius: scale(8),
    borderWidth: styleTokens.components.card.borderWidth,
    borderColor: styleTokens.components.card.borderColor,
  },
  tierBadge: {
    paddingHorizontal: scale(12),
    paddingVertical: scale(6),
    borderRadius: scale(12),
    minWidth: scale(60),
    alignItems: 'center',
    marginRight: scale(16),
    backgroundColor: styleTokens.colors.primaryLight,
    borderWidth: 1,
    borderColor: 'rgba(100, 226, 211, 0.6)',
  },
  tierHigh: {},
  tierMed: {},
  tierLow: {},
  tierText: {
    color: styleTokens.colors.textPrimary,
    fontSize: scale(12),
    fontWeight: '700',
  },
  tierCount: {
    fontSize: scale(16),
    fontWeight: '600',
    color: styleTokens.colors.textPrimary,
  },
  
  // Color Picker Modal Styles
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)', // Darker backdrop like infractions modal
    justifyContent: 'center',
    alignItems: 'center',
    padding: scale(16), // Consistent padding
  },
  modalContent: {
    width: '100%',
    maxWidth: scale(480), // Consistent max width
    backgroundColor: '#2a2a2a', // Dark background like infractions modal
    borderRadius: scale(12), // Consistent border radius
    borderWidth: 1,
    borderColor: 'rgba(100, 226, 211, 0.4)', // Primary color border
    padding: scale(16), // Consistent padding
    maxHeight: '80%',
    alignItems: 'center',
    ...styleTokens.shadows.lg, // Consistent shadow
  },
  modalTitle: {
    color: styleTokens.colors.white, // Changed from textPrimary to white
    textAlign: 'center',
    marginBottom: scale(24),
  },
  editSection: {
    width: '100%',
    marginBottom: scale(20),
  },
  sectionLabel: {
    color: styleTokens.colors.white, // Changed from textPrimary to white
    fontSize: scale(16),
    fontWeight: '600',
    marginBottom: scale(8),
  },
  teamNameInput: {
    width: '100%',
    marginBottom: scale(4),
  },
  colorListContainer: {
    width: '100%',
    maxHeight: scale(200),
  },
  colorListItem: {
    width: '100%',
    paddingVertical: scale(12),
    paddingHorizontal: scale(16),
    borderRadius: scale(8),
    marginBottom: scale(8),
    backgroundColor: styleTokens.colors.backgroundLight,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  colorListItemSelected: {
    backgroundColor: styleTokens.colors.primaryDark,
    borderColor: styleTokens.colors.primary,
  },
  colorListItemDisabled: {
    opacity: 0.4,
    backgroundColor: styleTokens.colors.disabled,
  },
  colorListItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(12),
  },
  colorPreview: {
    width: scale(24),
    height: scale(24),
    borderRadius: scale(12),
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  colorName: {
    flex: 1,
    color: styleTokens.colors.textPrimary,
    fontSize: scale(16),
    fontWeight: '500',
  },
  colorNameSelected: {
    color: styleTokens.colors.white,
    fontWeight: '600',
  },
  colorNameDisabled: {
    color: styleTokens.colors.textSecondary,
  },
  selectedIndicator: {
    color: styleTokens.colors.white,
    fontSize: scale(18),
    fontWeight: 'bold',
  },
  usedIndicator: {
    color: styleTokens.colors.textSecondary,
    fontSize: scale(12),
    fontStyle: 'italic',
  },
  modalButtons: {
    flexDirection: 'row',
    width: '100%',
    gap: scale(8),
    marginTop: scale(8),
  },
  modalButton: {
    flex: 1,
  },
  modalButtonStyle: {
    width: '100%',
    minHeight: scale(48),
    paddingVertical: scale(14),
    paddingHorizontal: scale(16),
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalButtonText: {
    fontSize: scale(15),
  },
  resetModalOverlay: {
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
  resetModalContent: {
    backgroundColor: styleTokens.colors.surface,
    borderRadius: scale(12),
    padding: scale(24),
    width: '90%',
    maxWidth: scale(400),
    ...styleTokens.shadows.lg,
  },
  resetModalTitle: {
    color: styleTokens.colors.textPrimary,
    marginBottom: scale(16),
    textAlign: 'center',
  },
  resetModalMessage: {
    color: styleTokens.colors.textSecondary,
    marginBottom: scale(24),
    textAlign: 'center',
    lineHeight: scale(20),
  },
  resetModalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: scale(12),
  },
  resetModalButtonCancel: {
    flex: 1,
    backgroundColor: styleTokens.colors.border,
    paddingVertical: scale(12),
    paddingHorizontal: scale(20),
    borderRadius: scale(8),
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: scale(48),
  },
  resetModalButtonConfirm: {
    flex: 1,
    backgroundColor: styleTokens.colors.error || '#e74c3c',
    paddingVertical: scale(12),
    paddingHorizontal: scale(20),
    borderRadius: scale(8),
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: scale(48),
  },
  resetModalButtonTextCancel: {
    color: styleTokens.colors.textPrimary,
    fontSize: scale(16),
    fontWeight: '600',
  },
  resetModalButtonTextConfirm: {
    color: styleTokens.colors.white,
    fontSize: scale(16),
    fontWeight: '600',
  },
});

export default AssignTeamsScreen; 