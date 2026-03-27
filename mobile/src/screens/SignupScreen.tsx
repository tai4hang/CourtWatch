import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Google from 'expo-auth-session/providers/google';
import { makeRedirectUri } from 'expo-auth-session';
import { useAuthStore } from '../store/authStore';
import { theme, styles as themeStyles } from '../theme';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../services/firebase';
import { api } from '../services/api';
import * as SecureStore from 'expo-secure-store';

export default function SignupScreen({ navigation }: any) {
  const { fetchUser } = useAuthStore();
  const [name, setName] = React.useState('');
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

  const handleSignup = async () => {
    setError('');

    // Validate name
    if (!name.trim()) {
      setError('Please enter your name');
      return;
    }

    // Validate email
    if (!email.trim()) {
      setError('Please enter your email address');
      return;
    }

    if (!validateEmail(email)) {
      setError('Please enter a valid email address');
      return;
    }

    // Validate password
    if (!password) {
      setError('Please enter a password');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    try {
      // Create user with Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      
      // Update profile with name
      // Note: Firebase doesn't have a built-in way to set display name directly
      // We'll pass it to the backend
      
      const idToken = await userCredential.user.getIdToken();
      
      // Send to backend to create user with the Firebase token
      const response_data = await api.firebaseRegister(idToken, name);
      
      const accessToken = String(response_data.accessToken || '');
      const refreshToken = String(response_data.refreshToken || '');
      
      // Store tokens
      await SecureStore.setItemAsync('accessToken', accessToken);
      await SecureStore.setItemAsync('refreshToken', refreshToken);
      
      // Update auth store
      await fetchUser();
    } catch (err: any) {
      console.error('Signup failed:', err);
      const message = err.message || 'Registration failed. Please try again.';
      setError(message);
      Alert.alert('Registration Failed', message);
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

      // Send to backend to create/get user
      const response_data = await api.googleLogin(idToken);
      
      const accessToken = String(response_data.accessToken || '');
      const refreshToken = String(response_data.refreshToken || '');
      
      // Store tokens
      await SecureStore.setItemAsync('accessToken', accessToken);
      await SecureStore.setItemAsync('refreshToken', refreshToken);
      
      // Update auth store
      await fetchUser();
    } catch (err: any) {
      console.error('Google callback failed:', err);
      setError(err.message || 'Google sign-in failed. Please try again.');
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <View style={themeStyles.container}>
      <Text style={themeStyles.title}>Create Account</Text>
      
      {error ? <Text style={themeStyles.errorText}>{error}</Text> : null}
      
      <TextInput
        style={themeStyles.input}
        placeholder="Name"
        placeholderTextColor="#999"
        value={name}
        onChangeText={(text) => {
          setName(text);
          setError('');
        }}
        autoComplete="name"
      />
      <TextInput
        style={themeStyles.input}
        placeholder="Email"
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
        placeholder="Password"
        placeholderTextColor="#999"
        value={password}
        onChangeText={(text) => {
          setPassword(text);
          setError('');
        }}
        secureTextEntry
        autoComplete="password-new"
      />
      <TouchableOpacity 
        style={[themeStyles.button, loading && styles.buttonDisabled]} 
        onPress={handleSignup}
        disabled={loading}
      >
        <Text style={themeStyles.buttonText}>{loading ? 'Creating Account...' : 'Sign Up'}</Text>
      </TouchableOpacity>

      <View style={styles.dividerContainer}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>or</Text>
        <View style={styles.dividerLine} />
      </View>

      <TouchableOpacity 
        style={[styles.googleButton, googleLoading && styles.buttonDisabled]} 
        onPress={handleGoogleSignIn}
        disabled={googleLoading || !request}
      >
        <Ionicons name="logo-google" size={24} color="#4285F4" style={styles.googleIcon} />
        <Text style={styles.googleButtonText}>
          {googleLoading ? 'Signing in...' : 'Sign up with Google'}
        </Text>
      </TouchableOpacity>
      
      <TouchableOpacity onPress={() => navigation.navigate('Login')}>
        <Text style={themeStyles.linkText}>
          Already have an account? <Text style={styles.linkHighlight}>Login</Text>
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
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
  googleButtonText: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: '500',
  },
});