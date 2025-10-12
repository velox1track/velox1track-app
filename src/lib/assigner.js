/**
 * Team assigner utility for balanced tier-based distribution
 * Uses round-robin assignment across High → Med → Low tiers
 */

// Team color palette - standard hex colors for track and field
const TEAM_COLORS = [
  '#FF0000', // Red
  '#0000FF', // Blue
  '#008000', // Green
  '#FFFF00', // Yellow
  '#FFA500', // Orange
  '#800080', // Purple
  '#FFC0CB', // Pink
  '#A52A2A', // Brown
  '#000000', // Black
  '#FFFFFF', // White
  '#808080', // Gray
  '#000080', // Navy
  '#008080', // Teal
  '#800000', // Maroon
  '#00FFFF', // Cyan
  '#C0C0C0'  // Silver
];

export const assignTeams = (athletes, numTeams) => {
  if (!athletes || athletes.length === 0) {
    return {
      success: false,
      error: 'No athletes provided'
    };
  }
  
  if (numTeams < 1) {
    return {
      success: false,
      error: 'Number of teams must be at least 1'
    };
  }
  
  // Separate and shuffle athletes by tier for randomness within balance
  const highTier = shuffleArray(athletes.filter(athlete => athlete.tier === 'High'));
  const medTier = shuffleArray(athletes.filter(athlete => athlete.tier === 'Med'));
  const lowTier = shuffleArray(athletes.filter(athlete => athlete.tier === 'Low'));
  
  // Initialize teams with colors
  const teams = Array.from({ length: numTeams }, (_, i) => ({
    id: i + 1,
    name: `Team ${i + 1}`,
    color: TEAM_COLORS[i % TEAM_COLORS.length],
    athletes: [],
    tierCounts: { high: 0, med: 0, low: 0 } // Track tier distribution
  }));
  
  // Balanced assignment strategy:
  // 1. Calculate target team sizes (as equal as possible)
  // 2. Use snake draft approach to balance talent while maintaining equal sizes
  // 3. Prioritize talent balance within size constraints
  
  const totalAthletes = athletes.length;
  const baseTeamSize = Math.floor(totalAthletes / numTeams);
  const extraAthletes = totalAthletes % numTeams; // Some teams get +1 athlete
  
  // Calculate target sizes for each team
  const targetSizes = teams.map((_, index) => 
    baseTeamSize + (index < extraAthletes ? 1 : 0)
  );
  
  // Create a combined pool of all athletes with tier priority
  // Sort by tier (High first, then Med, then Low) but shuffle within tiers
  const allAthletes = [
    ...highTier.map(a => ({ ...a, tierValue: 3 })),
    ...medTier.map(a => ({ ...a, tierValue: 2 })),
    ...lowTier.map(a => ({ ...a, tierValue: 1 }))
  ];
  
  // Snake draft assignment to balance talent while maintaining equal sizes
  let currentTeam = 0;
  let direction = 1; // 1 for forward, -1 for backward (snake pattern)
  
  allAthletes.forEach(athlete => {
    // Find teams that still need athletes
    const availableTeams = teams
      .map((team, index) => ({ team, index, currentSize: team.athletes.length, targetSize: targetSizes[index] }))
      .filter(t => t.currentSize < t.targetSize);
    
    if (availableTeams.length === 0) return; // All teams full
    
    // If only one team available, assign there
    if (availableTeams.length === 1) {
      const targetTeam = availableTeams[0];
      targetTeam.team.athletes.push(athlete);
      targetTeam.team.tierCounts[athlete.tier.toLowerCase()]++;
      return;
    }
    
    // Multiple teams available - use talent balance to decide
    // Find team with lowest talent score among available teams
    const teamScores = availableTeams.map(t => ({
      ...t,
      talentScore: t.team.tierCounts.high * 3 + t.team.tierCounts.med * 2 + t.team.tierCounts.low * 1
    }));
    
    // Sort by talent score (lowest first), then by team index for consistency
    teamScores.sort((a, b) => {
      if (a.talentScore !== b.talentScore) return a.talentScore - b.talentScore;
      return a.index - b.index;
    });
    
    // Assign to team with lowest talent score
    const selectedTeam = teamScores[0];
    selectedTeam.team.athletes.push(athlete);
    selectedTeam.team.tierCounts[athlete.tier.toLowerCase()]++;
  });
  
  // Remove temporary tierCounts from final result
  const finalTeams = teams.map(team => ({
    id: team.id,
    name: team.name,
    color: team.color,
    athletes: team.athletes
  }));
  
  return {
    success: true,
    teams: finalTeams,
    stats: {
      totalAthletes: athletes.length,
      highTier: highTier.length,
      medTier: medTier.length,
      lowTier: lowTier.length,
      averageTeamSize: Math.round(athletes.length / numTeams * 10) / 10,
      teamBalance: teams.map(team => ({
        teamName: team.name,
        talentScore: team.tierCounts.high * 3 + team.tierCounts.med * 2 + team.tierCounts.low * 1,
        distribution: `${team.tierCounts.high}H/${team.tierCounts.med}M/${team.tierCounts.low}L`
      }))
    }
  };
};

// Helper function to shuffle array for randomness
const shuffleArray = (array) => {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

export const moveAthlete = (teams, athleteId, fromTeamId, toTeamId) => {
  const fromTeam = teams.find(team => team.id === fromTeamId);
  const toTeam = teams.find(team => team.id === toTeamId);
  
  if (!fromTeam || !toTeam) {
    return {
      success: false,
      error: 'Invalid team ID'
    };
  }
  
  const athleteIndex = fromTeam.athletes.findIndex(athlete => athlete.id === athleteId);
  if (athleteIndex === -1) {
    return {
      success: false,
      error: 'Athlete not found in source team'
    };
  }
  
  const athlete = fromTeam.athletes.splice(athleteIndex, 1)[0];
  toTeam.athletes.push(athlete);
  
  return {
    success: true,
    teams: teams
  };
};

// Export color utilities for use in other components
export const getTeamColors = () => TEAM_COLORS;

export const getColorName = (colorHex) => {
  const colorMap = {
    '#FF0000': 'Red',
    '#0000FF': 'Blue',
    '#008000': 'Green', 
    '#FFFF00': 'Yellow',
    '#FFA500': 'Orange',
    '#800080': 'Purple',
    '#FFC0CB': 'Pink',
    '#A52A2A': 'Brown',
    '#000000': 'Black',
    '#FFFFFF': 'White',
    '#808080': 'Gray',
    '#000080': 'Navy',
    '#008080': 'Teal',
    '#800000': 'Maroon',
    '#00FFFF': 'Cyan',
    '#C0C0C0': 'Silver'
  };
  return colorMap[colorHex] || 'Custom';
}; 