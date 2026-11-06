import { HankenGrotesk_600SemiBold, HankenGrotesk_700Bold } from '@expo-google-fonts/hanken-grotesk';
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold } from '@expo-google-fonts/inter';
import { JetBrainsMono_400Regular, JetBrainsMono_500Medium, JetBrainsMono_700Bold } from '@expo-google-fonts/jetbrains-mono';
import { useFonts } from 'expo-font';
import { Tabs } from 'expo-router/js-tabs';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { colors } from '@/core/theme';
import { AppDrawer, TabBar } from '@/features/app-shell';
import { useMarketStreamLifecycle } from '@/features/market-stream';
import { usePairsMetaBootstrap } from '@/features/pairs-meta';
import { useSettingsSync } from '@/features/settings';
import { startTelemetry } from '@/features/telemetry';

void SplashScreen.preventAutoHideAsync();

/**
 * Composition root for the app: providers, fonts, global lifecycles
 * (socket, settings sync, telemetry) and the tab navigator.
 * Route files stay thin and delegate to feature screens.
 */
export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    HankenGrotesk_600SemiBold,
    HankenGrotesk_700Bold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    JetBrainsMono_400Regular,
    JetBrainsMono_500Medium,
    JetBrainsMono_700Bold,
  });

  // Start streaming immediately, in parallel with font loading.
  useMarketStreamLifecycle();
  useSettingsSync();
  usePairsMetaBootstrap();
  useEffect(() => startTelemetry(), []);

  useEffect(() => {
    if (fontsLoaded || fontError) void SplashScreen.hideAsync();
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <StatusBar style="light" />
        <View style={styles.root}>
          <Tabs
            tabBar={(props) => <TabBar {...props} />}
            screenOptions={{
              headerShown: false,
              // Hidden tabs stop re-rendering on ticks (react-native-screens freeze).
              freezeOnBlur: true,
              sceneStyle: { backgroundColor: colors.background },
            }}
          >
            <Tabs.Screen name="index" options={{ title: 'Terminal' }} />
            <Tabs.Screen name="markets" options={{ title: 'Markets' }} />
            <Tabs.Screen name="telemetry" options={{ title: 'Telemetry' }} />
            <Tabs.Screen name="settings" options={{ title: 'Settings' }} />
          </Tabs>
          <AppDrawer />
        </View>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
});
