import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Alert } from 'react-native';
import { useAuthStore } from '../store/authStore';
import { theme, styles as themeStyles } from '../theme';

export default function SignupScreen({ navigation }: any) {
  const { register } = useAuthStore();
  const [name, setName] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [error, setError] = React.useState('');
  const [loading, setLoading] = React.useState(false);

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

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setLoading(true);
    try {
      await register(email, password, name);
      navigation.replace('Courts');
    } catch (err: any) {
      console.error('Signup failed:', err);
      const message = err?.response?.data?.message || 'Registration failed. Please try again.';
      setError(message);
      Alert.alert('Registration Failed', message);
    } finally {
      setLoading(false);
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
});