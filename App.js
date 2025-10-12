import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { StatusBar } from 'expo-status-bar';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { loadFontsAsync } from './src/theme';

// Import the original app screens
import HomeScreen from './src/screens/HomeScreen';
import RaceRouletteScreen from './src/screens/RaceRouletteScreen';
import TeamBuilderScreen from './src/screens/TeamBuilderScreen';
import AssignTeamsScreen from './src/screens/AssignTeamsScreen';
import AssignRunnersScreen from './src/screens/AssignRunnersScreen';
import ScoreboardScreen from './src/screens/ScoreboardScreen';
import SettingsScreen from './src/screens/SettingsScreen';

const Stack = createStackNavigator();

export default function App() {
  const [fontsLoaded, setFontsLoaded] = useState(false);
  const [fontError, setFontError] = useState(null);

  useEffect(() => {
    async function loadFonts() {
      try {
        await loadFontsAsync(); // Using the centralized function
        setFontsLoaded(true);
      } catch (error) {
        console.error('Error loading fonts:', error);
        setFontError(error.message);
        setFontsLoaded(true);
      }
    }
    loadFonts();
  }, []);

  if (!fontsLoaded) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#64E2D3" />
        <Text style={styles.loadingText}>Loading Velox 1...</Text>
      </View>
    );
  }

  if (fontError) {
    console.warn('Font loading failed, using system fonts:', fontError);
  }

  return (
    <NavigationContainer>
      <StatusBar style="auto" />
      <Stack.Navigator
        initialRouteName="Home"
        screenOptions={{
          headerStyle: {
            backgroundColor: '#9FA7AE',
          },
          headerTintColor: '#080A0B',
          headerTitleStyle: {
            fontWeight: 'bold',
            fontFamily: 'RobotoMono-Bold',
          },
        }}
      >
        <Stack.Screen
          name="Home"
          component={HomeScreen}
          options={{ title: 'Velox 1 Race Roulette' }}
        />
        <Stack.Screen
          name="RaceRoulette"
          component={RaceRouletteScreen}
          options={{ title: 'Race Roulette' }}
        />
        <Stack.Screen
          name="TeamBuilder"
          component={TeamBuilderScreen}
          options={{ title: 'Team Builder' }}
        />
        <Stack.Screen
          name="AssignTeams"
          component={AssignTeamsScreen}
          options={{ title: 'Assign Teams' }}
        />
        <Stack.Screen
          name="AssignRunners"
          component={AssignRunnersScreen}
          options={{ title: 'Assign Athletes' }}
        />
        <Stack.Screen
          name="Scoreboard"
          component={ScoreboardScreen}
          options={{ title: 'Scoreboard' }}
        />
        <Stack.Screen
          name="Settings"
          component={SettingsScreen}
          options={{ title: 'Settings' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#9FA7AE',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 18,
    color: '#080A0B',
    fontFamily: 'System',
  },
}); 