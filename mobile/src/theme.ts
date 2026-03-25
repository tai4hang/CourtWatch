import { TextStyle, ViewStyle } from 'react-native';

// Light green theme for CourtWatch app
export const theme = {
  colors: {
    primary: '#4CAF50',
    primaryDark: '#388E3C',
    primaryLight: '#C8E6C9',
    background: '#F1F8E9',
    surface: '#FFFFFF',
    text: '#212121',
    textSecondary: '#757575',
    border: '#E0E0E0',
    error: '#D32F2F',
    success: '#4CAF50',
  },
};

export const styles = {
  container: {
    flex: 1,
    justifyContent: 'center' as const,
    padding: 20,
    backgroundColor: theme.colors.background,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold' as const,
    marginBottom: 30,
    textAlign: 'center' as const,
    color: theme.colors.text,
  },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 8,
    padding: 15,
    marginBottom: 15,
    fontSize: 16,
    backgroundColor: theme.colors.surface,
    color: theme.colors.text,
  },
  button: {
    backgroundColor: theme.colors.primary,
    padding: 15,
    borderRadius: 8,
    alignItems: 'center' as const,
    marginTop: 10,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600' as const,
  },
  linkText: {
    color: theme.colors.primary,
    fontSize: 14,
    marginTop: 15,
    textAlign: 'center' as const,
  },
  errorText: {
    color: theme.colors.error,
    fontSize: 14,
    marginBottom: 10,
    textAlign: 'center' as const,
  },
};