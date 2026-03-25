import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  ActivityIndicator,
  Alert,
  Linking,
  FlatList,
} from 'react-native';
import { useCourtStore, CourtReport, getStatusColor, getStatusLabel } from '../store/courtStore';
import { useAuthStore } from '../store/authStore';

interface CourtDetailScreenProps {
  route: { params: { courtId: string } };
  navigation: any;
}

export default function CourtDetailScreen({ route, navigation }: CourtDetailScreenProps) {
  const { courtId } = route.params;
  const { currentCourt, reports, isLoading, fetchCourtDetails, fetchCourtReports, addFavorite, removeFavorite, reportStatus } = useCourtStore();
  const { isAuthenticated } = useAuthStore();
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportForm, setReportForm] = useState({
    availableCourts: 0,
    queueGroups: 0,
    waitTimeMinutes: 0,
    status: 'available' as 'available' | 'partial' | 'full',
    reportType: 'availability' as 'availability' | 'queue',
  });

  useEffect(() => {
    loadData();
  }, [courtId]);

  const loadData = async () => {
    await fetchCourtDetails(courtId);
    await fetchCourtReports(courtId);
  };

  const handleToggleFavorite = async () => {
    if (!currentCourt) return;
    
    if (currentCourt.isFavorite) {
      await removeFavorite(courtId);
    } else {
      await addFavorite(courtId);
    }
  };

  const handleOpenMaps = () => {
    if (!currentCourt?.google_maps_url) {
      // Fallback to Apple Maps / Google Maps
      const url = `https://www.google.com/maps/search/?api=1&query=${currentCourt?.latitude},${currentCourt?.longitude}`;
      Linking.openURL(url);
      return;
    }
    Linking.openURL(currentCourt.google_maps_url);
  };

  const handleSubmitReport = async () => {
    if (!isAuthenticated) {
      Alert.alert('Login Required', 'Please login to report court status');
      navigation.navigate('Auth');
      return;
    }

    try {
      await reportStatus(courtId, {
        ...reportForm,
        waitTimeMinutes: reportForm.waitTimeMinutes || undefined,
      });
      setShowReportModal(false);
      Alert.alert('Success', 'Thank you for your report!');
    } catch (error) {
      Alert.alert('Error', 'Failed to submit report. Please try again.');
    }
  };

  const getAvailableCourtOptions = () => {
    if (!currentCourt) return [];
    return Array.from({ length: currentCourt.total_courts + 1 }, (_, i) => i);
  };

  if (isLoading || !currentCourt) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4F46E5" />
        <Text style={styles.loadingText}>Loading court details...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: getStatusColor(currentCourt.currentStatus) }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.favoriteButton} onPress={handleToggleFavorite}>
          <Text style={styles.favoriteIcon}>{currentCourt.isFavorite ? '❤️' : '🤍'}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        {/* Court Info Card */}
        <View style={styles.infoCard}>
          <Text style={styles.courtName}>{currentCourt.name}</Text>
          <Text style={styles.courtAddress}>{currentCourt.address}</Text>
          
          <View style={styles.statusRow}>
            <View style={[styles.statusBadge, { backgroundColor: getStatusColor(currentCourt.currentStatus) }]}>
              <Text style={styles.statusText}>{getStatusLabel(currentCourt.currentStatus)}</Text>
            </View>
            {currentCourt.lastReported && (
              <Text style={styles.lastReported}>
                Last reported: {new Date(currentCourt.lastReported).toLocaleString()}
              </Text>
            )}
          </View>
        </View>

        {/* Current Status Details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Current Status</Text>
          <View style={styles.statusGrid}>
            <View style={styles.statusItem}>
              <Text style={styles.statusValue}>{currentCourt.availableCourts ?? '-'}</Text>
              <Text style={styles.statusLabel}>Available</Text>
            </View>
            <View style={styles.statusItem}>
              <Text style={styles.statusValue}>/ {currentCourt.total_courts}</Text>
              <Text style={styles.statusLabel}>Total</Text>
            </View>
            <View style={styles.statusItem}>
              <Text style={styles.statusValue}>{currentCourt.queueGroups ?? '-'}</Text>
              <Text style={styles.statusLabel}>In Queue</Text>
            </View>
            <View style={styles.statusItem}>
              <Text style={styles.statusValue}>{currentCourt.waitTimeMinutes ? `${currentCourt.waitTimeMinutes}min` : '-'}</Text>
              <Text style={styles.statusLabel}>Wait Time</Text>
            </View>
          </View>
        </View>

        {/* Court Details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Court Details</Text>
          <View style={styles.detailCard}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Court Type</Text>
              <Text style={styles.detailValue}>{currentCourt.court_type}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Surface</Text>
              <Text style={styles.detailValue}>{currentCourt.surface}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Total Courts</Text>
              <Text style={styles.detailValue}>{currentCourt.total_courts}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Lighting</Text>
              <Text style={styles.detailValue}>{currentCourt.has_lights ? 'Yes' : 'No'}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Free to Play</Text>
              <Text style={styles.detailValue}>{currentCourt.is_free ? 'Yes' : 'No'}</Text>
            </View>
            {currentCourt.notes && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Notes</Text>
                <Text style={styles.detailValue}>{currentCourt.notes}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Actions</Text>
          <View style={styles.actionsRow}>
            <TouchableOpacity style={styles.actionButton} onPress={handleOpenMaps}>
              <Text style={styles.actionIcon}>📍</Text>
              <Text style={styles.actionText}>Open in Maps</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionButton, styles.reportButton]} onPress={() => setShowReportModal(true)}>
              <Text style={styles.actionIcon}>📊</Text>
              <Text style={styles.actionText}>Report Status</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Report History */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Reports</Text>
          {reports.length === 0 ? (
            <Text style={styles.emptyText}>No reports yet. Be the first to report!</Text>
          ) : (
            reports.slice(0, 10).map((report: CourtReport) => (
              <View key={report.id} style={styles.reportCard}>
                <View style={styles.reportHeader}>
                  <View style={[styles.reportStatusDot, { backgroundColor: getStatusColor(report.status) }]} />
                  <Text style={styles.reportStatus}>{getStatusLabel(report.status)}</Text>
                  <Text style={styles.reportTime}>
                    {new Date(report.created_at).toLocaleString()}
                  </Text>
                </View>
                <View style={styles.reportDetails}>
                  <Text style={styles.reportDetail}>
                    Available: {report.available_courts} courts
                  </Text>
                  {report.queue_groups > 0 && (
                    <Text style={styles.reportDetail}>
                      Queue: {report.queue_groups} groups
                    </Text>
                  )}
                  {report.wait_time_minutes && (
                    <Text style={styles.reportDetail}>
                      Wait: {report.wait_time_minutes} min
                    </Text>
                  )}
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {/* Report Modal */}
      <Modal visible={showReportModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Report Court Status</Text>
            
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>How many courts are available?</Text>
              <View style={styles.optionsRow}>
                {getAvailableCourtOptions().map((num) => (
                  <TouchableOpacity
                    key={num}
                    style={[
                      styles.optionButton,
                      reportForm.availableCourts === num && styles.optionButtonActive,
                    ]}
                    onPress={() => {
                      setReportForm({ 
                        ...reportForm, 
                        availableCourts: num,
                        status: num === 0 ? 'full' : num === currentCourt.total_courts ? 'available' : 'partial'
                      });
                    }}
                  >
                    <Text style={[
                      styles.optionText,
                      reportForm.availableCourts === num && styles.optionTextActive,
                    ]}>
                      {num}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>How many groups in queue?</Text>
              <View style={styles.optionsRow}>
                {[0, 1, 2, 3, 4, 5].map((num) => (
                  <TouchableOpacity
                    key={num}
                    style={[
                      styles.optionButton,
                      reportForm.queueGroups === num && styles.optionButtonActive,
                    ]}
                    onPress={() => setReportForm({ ...reportForm, queueGroups: num })}
                  >
                    <Text style={[
                      styles.optionText,
                      reportForm.queueGroups === num && styles.optionTextActive,
                    ]}>
                      {num}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Estimated wait time (minutes)</Text>
              <TextInput
                style={styles.input}
                value={reportForm.waitTimeMinutes > 0 ? String(reportForm.waitTimeMinutes) : ''}
                onChangeText={(text) => setReportForm({ ...reportForm, waitTimeMinutes: parseInt(text) || 0 })}
                keyboardType="number-pad"
                placeholder="0"
                placeholderTextColor="#9CA3AF"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Overall Status</Text>
              <View style={styles.statusButtonsRow}>
                {(['available', 'partial', 'full'] as const).map((status) => (
                  <TouchableOpacity
                    key={status}
                    style={[
                      styles.statusButton,
                      { backgroundColor: getStatusColor(status) },
                      reportForm.status === status && styles.statusButtonActive,
                    ]}
                    onPress={() => setReportForm({ ...reportForm, status })}
                  >
                    <Text style={styles.statusButtonText}>{getStatusLabel(status)}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={styles.cancelButton}
                onPress={() => setShowReportModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.submitButton}
                onPress={handleSubmitReport}
              >
                <Text style={styles.submitButtonText}>Submit Report</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  header: {
    padding: 20,
    paddingTop: 50,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButtonText: {
    fontSize: 24,
    color: '#FFFFFF',
  },
  favoriteButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  favoriteIcon: {
    fontSize: 24,
  },
  content: {
    flex: 1,
  },
  infoCard: {
    backgroundColor: '#FFFFFF',
    margin: 16,
    marginTop: -20,
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  courtName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 8,
  },
  courtAddress: {
    fontSize: 16,
    color: '#6B7280',
    marginBottom: 16,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statusBadge: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  statusText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
  lastReported: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  section: {
    padding: 16,
    paddingTop: 0,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 12,
  },
  statusGrid: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
  },
  statusItem: {
    flex: 1,
    alignItems: 'center',
  },
  statusValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  statusLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
  },
  detailCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  detailLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  detailValue: {
    fontSize: 14,
    color: '#1F2937',
    fontWeight: '500',
    textTransform: 'capitalize',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  reportButton: {
    backgroundColor: '#4F46E5',
  },
  actionIcon: {
    fontSize: 20,
  },
  actionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
  },
  reportCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  reportHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  reportStatusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  reportStatus: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
    flex: 1,
  },
  reportTime: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  reportDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  reportDetail: {
    fontSize: 12,
    color: '#6B7280',
  },
  emptyText: {
    textAlign: 'center',
    color: '#9CA3AF',
    padding: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6B7280',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 20,
  },
  formGroup: {
    marginBottom: 20,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  optionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  optionButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  optionButtonActive: {
    backgroundColor: '#4F46E5',
    borderColor: '#4F46E5',
  },
  optionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  optionTextActive: {
    color: '#FFFFFF',
  },
  input: {
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#1F2937',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  statusButtonsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  statusButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  statusButtonActive: {
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  statusButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 12,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
  },
  submitButton: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
    backgroundColor: '#4F46E5',
    borderRadius: 12,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});