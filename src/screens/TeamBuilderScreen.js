import React, { useState, useEffect } from 'react';
import { 
  View, 
  StyleSheet, 
  ScrollView, 
  Alert
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import AthleteForm from '../components/AthleteForm';
import CSVImporter from '../components/CSVImporter';
import { MobileH1, MobileH2, MobileBody, MobileCaption } from '../components/Typography';
import { Card } from '../components/Card';
import { ButtonPrimary, ButtonSecondary } from '../components';
import { styleTokens } from '../theme';
import { scale } from '../utils/scale';

const TeamBuilderScreen = () => {
  const [athletes, setAthletes] = useState([]);
  const [showCSVImporter, setShowCSVImporter] = useState(false);

  // Load saved athletes on component mount
  useEffect(() => {
    loadAthletes();
  }, []);

  const loadAthletes = async () => {
    try {
      const savedAthletes = await AsyncStorage.getItem('athletes');
      if (savedAthletes) {
        setAthletes(JSON.parse(savedAthletes));
      }
    } catch (error) {
      console.log('Error loading athletes:', error);
    }
  };

  const saveAthletes = async (newAthletes) => {
    try {
      await AsyncStorage.setItem('athletes', JSON.stringify(newAthletes));
    } catch (error) {
      console.log('Error saving athletes:', error);
    }
  };

  const addAthlete = (athlete) => {
    const newAthletes = [...athletes, athlete];
    setAthletes(newAthletes);
    saveAthletes(newAthletes);
    Alert.alert('Success', `${athlete.name} added successfully!`);
  };

  const importAthletes = (importedAthletes) => {
    const newAthletes = [...athletes, ...importedAthletes];
    setAthletes(newAthletes);
    saveAthletes(newAthletes);
  };

  const deleteAthlete = (athleteId) => {
    Alert.alert(
      'Delete Athlete',
      'Are you sure you want to delete this athlete?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: () => {
            const newAthletes = athletes.filter(a => a.id !== athleteId);
            setAthletes(newAthletes);
            saveAthletes(newAthletes);
          }
        }
      ]
    );
  };

  const clearAllAthletes = () => {
    Alert.alert(
      'Clear All Athletes',
      'Are you sure you want to delete all athletes? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Clear All', 
          style: 'destructive',
          onPress: () => {
            setAthletes([]);
            saveAthletes([]);
          }
        }
      ]
    );
  };

  const getTierCount = (tier) => {
    return athletes.filter(athlete => athlete.tier === tier).length;
  };

  return (
    <View style={styles.container}>
      <ScrollView 
        style={styles.scrollView} 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={true}
      >
        {/* Form Section */}
        <Card style={styles.sectionCard} variant="primary">
          <MobileH2 style={styles.sectionTitle}>Add Athlete</MobileH2>
          <AthleteForm onAddAthlete={addAthlete} />
        </Card>

        {/* CSV Import Section */}
        <Card style={styles.sectionCard} variant="primary">
          <View style={styles.csvHeader}>
            <MobileH2 style={[styles.sectionTitle, styles.sectionTitleWrap, styles.csvTitle]}>CSV Import</MobileH2>
            <ButtonSecondary style={styles.csvToggleButton} onPress={() => setShowCSVImporter(!showCSVImporter)}>
              {showCSVImporter ? 'Hide' : 'Show'}
            </ButtonSecondary>
          </View>
          {showCSVImporter && (
            <View style={styles.csvBody}>
              <MobileCaption style={styles.csvHelp}>Import athletes from a CSV file</MobileCaption>
              <CSVImporter onImportAthletes={importAthletes} />
            </View>
          )}
        </Card>

        {/* Athletes List */}
        <Card style={styles.athletesSection}>
          <View style={styles.sectionHeader}>
            <MobileH2 style={[styles.sectionTitle, styles.sectionTitleWrap]}>Athletes ({athletes.length})</MobileH2>
            {athletes.length > 0 && (
              <ButtonSecondary onPress={clearAllAthletes}>
                Clear All
              </ButtonSecondary>
            )}
          </View>

          {/* Tier Summary */}
          {athletes.length > 0 && (
            <View style={styles.tierSummary}>
              <View style={styles.tierItem}>
                <View style={[styles.tierBadge, styles.tierHigh]}>
                  <MobileCaption style={styles.tierText}>High</MobileCaption>
                </View>
                <MobileBody>{getTierCount('High')}</MobileBody>
              </View>
              <View style={styles.tierItem}>
                <View style={[styles.tierBadge, styles.tierMed]}>
                  <MobileCaption style={styles.tierText}>Med</MobileCaption>
                </View>
                <MobileBody>{getTierCount('Med')}</MobileBody>
              </View>
              <View style={styles.tierItem}>
                <View style={[styles.tierBadge, styles.tierLow]}>
                  <MobileCaption style={styles.tierText}>Low</MobileCaption>
                </View>
                <MobileBody>{getTierCount('Low')}</MobileBody>
              </View>
            </View>
          )}

          {/* Athletes List */}
          {athletes.length === 0 ? (
            <View style={styles.emptyContainer}>
              <MobileH1 style={styles.emptyTitle}>No athletes added yet</MobileH1>
              <MobileBody style={styles.emptySubtext}>
                Use the form above or CSV import to add athletes
              </MobileBody>
            </View>
          ) : (
            <View style={styles.athletesList}>
              {athletes.map((athlete) => (
                <View key={athlete.id} style={styles.athleteCard}>
                  <View style={styles.athleteInfo}>
                    <MobileH2 style={styles.athleteName} numberOfLines={2}>{athlete.name}</MobileH2>
                    <View style={[styles.tierBadge, styles[`tier${athlete.tier}`]]}>
                      <MobileCaption style={styles.tierText}>{athlete.tier}</MobileCaption>
                    </View>
                  </View>
                  {athlete.bestEvents && (
                    <MobileCaption style={styles.bestEvents} numberOfLines={2}>{athlete.bestEvents}</MobileCaption>
                  )}
                  <ButtonSecondary onPress={() => deleteAthlete(athlete.id)}>
                    Delete
                  </ButtonSecondary>
                </View>
              ))}
            </View>
          )}
        </Card>
      </ScrollView>
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
    textAlign: 'left',
  },
  sectionTitleWrap: {
    flexShrink: 1,
    flexWrap: 'wrap',
  },
  csvHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: scale(8),
    flexWrap: 'wrap',
    gap: scale(12),
  },
  csvTitle: {
    flex: 1,
  },
  csvToggleButton: {
    alignSelf: 'flex-end',
  },
  csvBody: {
    gap: scale(12),
  },
  csvHelp: {
    color: styleTokens.colors.textSecondary,
    opacity: 0.8,
  },
  csvToggleContainer: {
    alignItems: 'center',
    marginVertical: scale(16),
  },
  athletesSection: {
    marginHorizontal: scale(0),
    padding: scale(20),
    borderRadius: scale(12),
    shadowColor: styleTokens.colors.shadow,
    shadowOffset: { width: 0, height: scale(4) },
    shadowOpacity: 0.15,
    shadowRadius: scale(8),
    elevation: 3,
    marginBottom: scale(16),
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: scale(16),
    flexWrap: 'wrap',
    gap: scale(12),
  },
  clearButton: {
    backgroundColor: styleTokens.colors.danger,
    paddingHorizontal: scale(16),
    paddingVertical: scale(8),
    borderRadius: scale(6),
  },
  clearButtonText: {
    color: styleTokens.colors.white,
    fontSize: scale(14),
    fontWeight: 'bold',
  },
  tierSummary: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: scale(20),
    padding: scale(16),
    backgroundColor: styleTokens.colors.surface,
    borderRadius: scale(8),
  },
  tierItem: {
    alignItems: 'center',
  },
  tierBadge: {
    paddingHorizontal: scale(12),
    paddingVertical: scale(6),
    borderRadius: scale(12),
    minWidth: scale(60),
    alignItems: 'center',
    marginBottom: scale(4),
  },
  tierHigh: {
    backgroundColor: 'rgba(100, 226, 211, 0.25)',
    borderWidth: 1,
    borderColor: styleTokens.colors.primary,
  },
  tierMed: {
    backgroundColor: 'rgba(100, 226, 211, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(100, 226, 211, 0.8)',
  },
  tierLow: {
    backgroundColor: styleTokens.colors.primaryLight,
    borderWidth: 1,
    borderColor: 'rgba(100, 226, 211, 0.5)',
  },
  tierText: {
    color: styleTokens.colors.textPrimary,
    fontSize: scale(12),
    fontWeight: '700',
  },
  tierCount: {
    fontSize: scale(18),
    fontWeight: 'bold',
    color: styleTokens.colors.textPrimary,
  },
  emptyContainer: {
    alignItems: 'center',
    padding: scale(24),
  },
  emptyTitle: {
    color: styleTokens.colors.textSecondary,
    textAlign: 'center',
    marginBottom: scale(8),
  },
  emptyText: {
    fontSize: scale(18),
    color: styleTokens.colors.textSecondary,
    marginBottom: scale(8),
  },
  emptySubtext: {
    fontSize: scale(14),
    color: styleTokens.colors.textSecondary,
    textAlign: 'center',
    lineHeight: scale(20),
    opacity: 0.7,
  },
  athletesList: {
    gap: scale(12),
  },
  athleteCard: {
    backgroundColor: styleTokens.components.card.backgroundColor,
    padding: scale(16),
    borderRadius: scale(8),
    borderLeftWidth: scale(4),
    borderLeftColor: styleTokens.colors.primary,
    borderColor: styleTokens.components.card.borderColor,
    borderWidth: styleTokens.components.card.borderWidth,
    ...styleTokens.shadows.sm,
  },
  athleteInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: scale(8),
    gap: scale(8),
    flexWrap: 'wrap',
  },
  athleteName: {
    color: styleTokens.colors.textPrimary,
    flex: 1,
    flexShrink: 1,
  },
  bestEvents: {
    fontSize: scale(14),
    color: styleTokens.colors.textSecondary,
    fontStyle: 'italic',
    marginBottom: scale(12),
  },
  deleteButton: {
    backgroundColor: styleTokens.colors.danger,
    paddingHorizontal: scale(16),
    paddingVertical: scale(8),
    borderRadius: scale(6),
    alignSelf: 'flex-end',
  },
  deleteButtonText: {
    color: styleTokens.colors.white,
    fontSize: scale(14),
    fontWeight: 'bold',
  },
});

export default TeamBuilderScreen; 