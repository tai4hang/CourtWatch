import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Alert, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri } from 'expo-auth-session';
import { useAuthStore } from '../store/authStore';
import { theme, styles as themeStyles } from '../theme';
import { GoogleAuthProvider, signInWithCredential, signInWithEmailAndPassword, EmailAuthProvider } from 'firebase/auth';
import { auth } from '../services/firebase';
import { api } from '../services/api';
import * as SecureStore from 'expo-secure-store';

export default function LoginScreen({ navigation }: any) {
  const { login, fetchUser } = useAuthStore();
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [error, setError] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [googleLoading, setGoogleLoading] = React.useState(false);

  // Google auth request
  const [request, response, promptAsync] = Google.useAuthRequest({
    iosClientId: '542775745789-8k9l7m6n5o4p3q2r1s0t.apps.googleusercontent.com',
    androidClientId: '542775745789-ad88fc6a51579fb244f294.apps.googleusercontent.com',
    webClientId: '542775745789.apps.googleusercontent.com',
    scopes: ['openid', 'email', 'profile'],
    redirectUri: makeRedirectUri({
      native: 'com.courtwatch.app://oauth2callback',
    }),
  });

  React.useEffect(() => {
    if (response?.type === 'success') {
      handleGoogleCallback(response.params?.id_token);
    }
  }, [response]);

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleLogin = async () => {
    setError('');

    if (!email.trim()) {
      setError('Please enter your email address');
      return;
    }

    if (!validateEmail(email)) {
      setError('Please enter a valid email address');
      return;
    }

    if (!password) {
      setError('Please enter your password');
      return;
    }

    setLoading(true);
    try {
      // Sign in with Firebase
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const idToken = await userCredential.user.getIdToken();
      
      // Send to backend to create session
      const response = await api.firebaseLogin(idToken);
      
      const accessToken = String(response.accessToken || '');
      const refreshToken = String(response.refreshToken || '');
      
      // Store tokens
      await SecureStore.setItemAsync('accessToken', accessToken);
      await SecureStore.setItemAsync('refreshToken', refreshToken);
      
      // Update auth store
      await fetchUser();
      navigation.replace('Tab');
    } catch (err: any) {
      console.error('Login failed:', err);
      const message = err.message || 'Login failed. Please check your credentials.';
      setError(message);
      Alert.alert('Login Failed', message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError('');
    setGoogleLoading(true);
    try {
      await promptAsync();
    } catch (err: any) {
      console.error('Google sign-in failed:', err);
      setError('Google sign-in failed. Please try again.');
      setGoogleLoading(false);
    }
  };

  const handleGoogleCallback = async (idToken?: string) => {
    try {
      const result = response as any;
      if (!idToken && result?.params?.id_token) {
        idToken = result.params.id_token;
      }

      if (!idToken) {
        throw new Error('No ID token received');
      }

      // Sign in to Firebase with the Google ID token
      const credential = GoogleAuthProvider.credential(idToken);
      const firebaseUser = await signInWithCredential(auth, credential);
      
      // Get the Firebase ID token
      const firebaseIdToken = await firebaseUser.user.getIdToken();
      
      // Send to backend to create/get user
      const response_data = await api.googleLogin(firebaseIdToken);
      
      const accessToken = String(response_data.accessToken || '');
      const refreshToken = String(response_data.refreshToken || '');
      
      // Store tokens
      await SecureStore.setItemAsync('accessToken', accessToken);
      await SecureStore.setItemAsync('refreshToken', refreshToken);
      
      // Update auth store
      await fetchUser();
      navigation.replace('Tab');
    } catch (err: any) {
      console.error('Google callback failed:', err);
      setError(err.message || 'Google sign-in failed. Please try again.');
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <View style={themeStyles.container}>
      <View style={styles.logoContainer}>
        <Image source={require('../../assets/app-logo.png')} style={styles.logo} resizeMode="contain" />
      </View>
      <View style={styles.titleRow}>
        <Ionicons name="tennisball" size={22} color={theme.colors.primary} style={styles.titleIcon} />
        <Text style={styles.loginTitle}>Log in</Text>
      </View>
      
      {error ? <Text style={themeStyles.errorText}>{error}</Text> : null}
      
      <TextInput
        style={themeStyles.input}
        placeholder="Enter your email"
        placeholderTextColor="#999"
        value={email}
        onChangeText={(text) => {
          setEmail(text);
          setError('');
        }}
        autoCapitalize="none"
        keyboardType="email-address"
        autoComplete="email"
      />
      <TextInput
        style={themeStyles.input}
        placeholder="Enter password"
        placeholderTextColor="#999"
        value={password}
        onChangeText={(text) => {
          setPassword(text);
          setError('');
        }}
        secureTextEntry
        autoComplete="password"
      />
      <TouchableOpacity 
        style={[themeStyles.button, loading && styles.buttonDisabled]} 
        onPress={handleLogin}
        disabled={loading}
      >
        <Text style={themeStyles.buttonText}>{loading ? 'Logging in...' : 'Log in'}</Text>
      </TouchableOpacity>

      <View style={styles.dividerContainer}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>Or</Text>
        <View style={styles.dividerLine} />
      </View>

      <TouchableOpacity 
        style={[styles.googleButton, googleLoading && styles.buttonDisabled]} 
        onPress={handleGoogleSignIn}
        disabled={googleLoading || !request}
      >
        <View style={styles.googleGContainer}>
          <View style={[styles.gDot, { backgroundColor: '#4285F4' }]} />
          <View style={[styles.gDot, { backgroundColor: '#EA4335' }]} />
          <View style={[styles.gDot, { backgroundColor: '#FBBC05' }]} />
          <View style={[styles.gDot, { backgroundColor: '#34A853' }]} />
        </View>
        <Text style={styles.googleButtonText}>
          {googleLoading ? 'Logging in...' : 'Log in with Google'}
        </Text>
      </TouchableOpacity>
      
      <TouchableOpacity onPress={() => navigation.navigate('Signup')}>
        <Text style={themeStyles.linkText}>
          Don't have an account? <Text style={styles.linkHighlight}>Sign Up</Text>
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  logoContainer: {
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  logo: {
    width: 240,
    height: 240,
    marginBottom: 10,
    resizeMode: 'contain',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 15,
  },
  titleIcon: {
    marginRight: 6,
  },
  loginTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: theme.colors.text,
  },
  linkHighlight: {
    fontWeight: '600',
    textDecorationLine: 'underline' as const,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
    width: '100%',
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: theme.colors.border,
  },
  dividerText: {
    marginHorizontal: 15,
    color: theme.colors.textSecondary,
    fontSize: 14,
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 8,
    padding: 15,
    marginTop: 5,
  },
  googleIcon: {
    marginRight: 10,
  },
  googleGContainer: {
    marginRight: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  gDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginHorizontal: 1,
  },
  googleButtonText: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: '500',
  },
});