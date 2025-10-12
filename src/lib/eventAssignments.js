/**
 * Event Assignments utility for managing athlete-to-event assignments
 * Supports one-and-done enforcement and relay team selection
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'eventAssignments';

/**
 * Data structure:
 * [
 *   {
 *     eventIndex: 0,
 *     eventName: "100m",
 *     isRelay: false,
 *     assignments: [
 *       { teamId: 1, athleteIds: ["athlete1"] },
 *       { teamId: 2, athleteIds: ["athlete2"] }
 *     ]
 *   }
 * ]
 */

export const loadEventAssignments = async () => {
  try {
    const data = await AsyncStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.log('Error loading event assignments:', error);
    return [];
  }
};

export const saveEventAssignments = async (assignments) => {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(assignments));
    return true;
  } catch (error) {
    console.log('Error saving event assignments:', error);
    return false;
  }
};

export const getAssignmentForEvent = (assignments, eventIndex) => {
  return assignments.find(a => a.eventIndex === eventIndex);
};

export const setAssignmentForEvent = async (assignments, eventIndex, eventName, isRelay, teamAssignments) => {
  const newAssignment = {
    eventIndex,
    eventName,
    isRelay,
    assignments: teamAssignments,
    timestamp: new Date().toISOString()
  };

  const filtered = assignments.filter(a => a.eventIndex !== eventIndex);
  const updated = [...filtered, newAssignment].sort((a, b) => a.eventIndex - b.eventIndex);
  
  const success = await saveEventAssignments(updated);
  return success ? updated : assignments;
};

export const getAllUsedAthleteIds = (assignments) => {
  const usedIds = new Set();
  assignments.forEach(assignment => {
    assignment.assignments.forEach(teamAssignment => {
      teamAssignment.athleteIds.forEach(athleteId => {
        usedIds.add(athleteId);
      });
    });
  });
  return Array.from(usedIds);
};

export const getUsedAthleteIdsExcludingEvent = (assignments, excludeEventIndex) => {
  const usedIds = new Set();
  assignments
    .filter(a => a.eventIndex !== excludeEventIndex)
    .forEach(assignment => {
      assignment.assignments.forEach(teamAssignment => {
        teamAssignment.athleteIds.forEach(athleteId => {
          // Skip 'NOT_RUNNING' markers
          if (athleteId !== 'NOT_RUNNING') {
            usedIds.add(athleteId);
          }
        });
      });
    });
  return Array.from(usedIds);
};

export const getUsedAthleteIdsUpToEvent = (assignments, eventIndex) => {
  const usedIds = new Set();
  assignments
    .filter(a => a.eventIndex < eventIndex)
    .forEach(assignment => {
      assignment.assignments.forEach(teamAssignment => {
        teamAssignment.athleteIds.forEach(athleteId => {
          usedIds.add(athleteId);
        });
      });
    });
  return Array.from(usedIds);
};

export const isAthleteUsed = (assignments, athleteId, beforeEventIndex = null) => {
  const relevantAssignments = beforeEventIndex !== null 
    ? assignments.filter(a => a.eventIndex < beforeEventIndex)
    : assignments;
    
  return relevantAssignments.some(assignment =>
    assignment.assignments.some(teamAssignment =>
      teamAssignment.athleteIds.includes(athleteId)
    )
  );
};

export const getTeamAssignmentForEvent = (assignments, eventIndex, teamId) => {
  const eventAssignment = getAssignmentForEvent(assignments, eventIndex);
  if (!eventAssignment) return null;
  
  return eventAssignment.assignments.find(ta => ta.teamId === teamId);
};

export const isEventFullyAssigned = (assignments, eventIndex, teams) => {
  const eventAssignment = getAssignmentForEvent(assignments, eventIndex);
  if (!eventAssignment) return false;
  
  // An event is considered "assigned" if it has any team assignments
  // This covers cases where some teams are running (have athletes) and others are not running
  return eventAssignment.assignments.length > 0;
};

export const getAssignmentStats = (assignments, teams) => {
  const totalEvents = assignments.length;
  const fullyAssignedEvents = assignments.filter(assignment => 
    teams.every(team => {
      const teamAssignment = assignment.assignments.find(ta => ta.teamId === team.id);
      return teamAssignment && teamAssignment.athleteIds.length > 0;
    })
  ).length;
  
  const totalAthletes = teams.reduce((sum, team) => sum + team.athletes.length, 0);
  const usedAthletes = getAllUsedAthleteIds(assignments).length;
  
  return {
    totalEvents,
    fullyAssignedEvents,
    totalAthletes,
    usedAthletes,
    availableAthletes: totalAthletes - usedAthletes
  };
};

export const clearAllAssignments = async () => {
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
    return true;
  } catch (error) {
    console.log('Error clearing assignments:', error);
    return false;
  }
};

export const isRelayEvent = (eventName) => {
  // Check if event is from relays category or contains relay indicators
  return eventName && (
    eventName.includes('4x') || 
    eventName.includes('-') || // Mixed relays like "100-100-200-400"
    eventName.toLowerCase().includes('relay')
  );
};

export const getRelayAthleteCount = (eventName) => {
  if (!eventName) return 4; // Default fallback
  
  // Parse different relay formats
  const name = eventName.toLowerCase();
  
  // Standard 4x relays (4x100, 4x200, etc.)
  if (name.includes('4x')) {
    return 4;
  }
  
  // Mixed relays with dashes (100-100-200-400)
  if (name.includes('-')) {
    const segments = name.split('-');
    // Count the number of distance segments
    const distanceSegments = segments.filter(segment => 
      /^\d+/.test(segment.trim()) // Starts with a number
    );
    return distanceSegments.length > 0 ? distanceSegments.length : 4;
  }
  
  // Named relays containing "relay"
  if (name.includes('relay')) {
    // Could be configurable in the future, default to 4
    return 4;
  }
  
  // Default to 4 for any unrecognized relay format
  return 4;
};

