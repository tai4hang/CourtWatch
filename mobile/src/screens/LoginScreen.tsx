import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Alert, Image } from 'react-native';
import { useAuthStore } from '../store/authStore';
import { theme, styles as themeStyles } from '../theme';

export default function LoginScreen({ navigation }: any) {
  const { login } = useAuthStore();
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [error, setError] = React.useState('');
  const [loading, setLoading] = React.useState(false);

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleLogin = async () => {
    setError('');

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
      setError('Please enter your password');
      return;
    }

    setLoading(true);
    try {
      await login(email, password);
      navigation.replace('Courts');
    } catch (err: any) {
      console.error('Login failed:', err);
      // Show user-friendly error message
      const message = err?.response?.data?.message || 'Login failed. Please check your credentials.';
      setError(message);
      Alert.alert('Login Failed', message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={themeStyles.container}>
      <View style={styles.logoContainer}>
        <Image source={require('../../assets/app-logo.png')} style={styles.logo} resizeMode="contain" />
      </View>
      <Text style={themeStyles.title}>Welcome Back</Text>
      
      {error ? <Text style={themeStyles.errorText}>{error}</Text> : null}
      
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
        autoComplete="password"
      />
      <TouchableOpacity 
        style={[themeStyles.button, loading && styles.buttonDisabled]} 
        onPress={handleLogin}
        disabled={loading}
      >
        <Text style={themeStyles.buttonText}>{loading ? 'Logging in...' : 'Login'}</Text>
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
  linkHighlight: {
    fontWeight: '600',
    textDecorationLine: 'underline' as const,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});