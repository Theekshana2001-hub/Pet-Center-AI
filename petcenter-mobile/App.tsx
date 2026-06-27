import React, { useState, useEffect, useRef } from 'react';
import { 
  StyleSheet, Text, View, TextInput, TouchableOpacity, 
  Image, ScrollView, ActivityIndicator, Alert, Modal, Linking, AppState, AppStateStatus,
  Share // 🔗 React Native Share API එක මෙතනට එකතු කළා මචං
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Notifications from 'expo-notifications';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

// 🌐 🛠️ ඔයාගේ PC එකේ දැනට තියෙන IPv4 Address එක මෙතනට නිවැරදිව ලබාදෙන්න මචං
const API_BASE_URL = "http://192.168.8.192:8000";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

interface ScanHistoryItem {
  id: string;
  image_base64: string;
  analysis_result: string;
  language: string;
  scanned_at: string;
}

export default function App() {
  const [email, setEmail] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  
  const [image, setImage] = useState<string | null>(null);
  const [base64Image, setBase64Image] = useState('');
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);
  const [language, setLanguage] = useState('English');
  const [showVets, setShowVets] = useState(false);
  
  // 📜 Recent Scans State
  const [recentScans, setRecentScans] = useState<ScanHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  
  const appState = useRef(AppState.currentState);

  // Auto-Refresh Setup
  useEffect(() => {
    (async () => {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please enable notifications.');
      }
    })();

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, [isLoggedIn]);

  const handleAppStateChange = (nextAppState: AppStateStatus) => {
    if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
      if (isLoggedIn) fetchScanHistory();
    }
    appState.current = nextAppState;
  };

  const fetchScanHistory = async () => {
    setHistoryLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/scan-history`);
      if (res.ok) {
        const data = await res.json();
        setRecentScans(data);
      }
    } catch (err) {
      console.log("Error fetching history:", err);
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    if (isLoggedIn) fetchScanHistory();
  }, [isLoggedIn]);

  const triggerLocalNotification = async (title: string, body: string) => {
    await Notifications.scheduleNotificationAsync({
      content: { title, body, sound: 'default' },
      trigger: null,
    });
  };

  // 🔑 Secure Email Login
  const handleLogin = async () => {
    if (!email) return Alert.alert("Error", "Please enter your email address!");
    setLoginLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/customer-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() })
      });
      if (res.ok) {
        setIsLoggedIn(true);
        triggerLocalNotification("🔒 Security Alert", `Logged in successfully as ${email}`);
      } else {
        const data = await res.json();
        Alert.alert("Login Failed", data.detail || "Something went wrong");
      }
    } catch (error) {
      Alert.alert("Connection Error", "Cannot connect to the FastAPI backend server.");
    } finally {
      setLoginLoading(false);
    }
  };

  // Camera / Gallery Actions
  const takePhoto = async () => {
    const cameraPermission = await ImagePicker.requestCameraPermissionsAsync();
    if (cameraPermission.status !== 'granted') return Alert.alert("Permission Denied", "Camera access required.");
    let result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [4, 3], quality: 0.6, base64: true,
    });
    if (!result.canceled && result.assets[0].base64) {
      setImage(result.assets[0].uri);
      setBase64Image(result.assets[0].base64);
    }
  };

  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [4, 3], quality: 0.6, base64: true,
    });
    if (!result.canceled && result.assets[0].base64) {
      setImage(result.assets[0].uri);
      setBase64Image(result.assets[0].base64);
    }
  };

  // AI Analysis
  const handleAnalyze = async () => {
    if (!base64Image) return Alert.alert("Error", "Please select or capture a photo first!");
    setLoading(true);
    setResult('');
    try {
      const res = await fetch(`${API_BASE_URL}/api/analyze-dog`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_base64: base64Image, language: language })
      });
      const data = await res.json();
      if (res.ok) {
        setResult(data.analysis);
        triggerLocalNotification("📋 Analysis Complete", "Your pet's health report is ready.");
        fetchScanHistory();
      } else {
        Alert.alert("Error", "AI processing failed");
      }
    } catch (error) {
      Alert.alert("Error", "Failed to reach AI server.");
    } finally {
      setLoading(false);
    }
  };

  // 📜 History Item එකක් Click කලාම Main View එකට Load වෙන Logic එක
  const loadHistoryItemToMainView = (item: ScanHistoryItem) => {
    setImage(`data:image/jpeg;base64,${item.image_base64}`);
    setBase64Image(item.image_base64);
    setResult(item.analysis_result);
    Alert.alert("Loaded", "Scan details and image loaded back to the active preview card!");
  };

  const handleDeleteScan = (id: string) => {
    Alert.alert(
      "Delete Scan Log",
      "Are you sure you want to remove this scan history record?",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Delete", 
          style: "destructive", 
          onPress: () => {
            setRecentScans(prev => prev.filter(item => item.id !== id));
            triggerLocalNotification("🗑️ Deleted", "Scan history log cleared locally.");
          } 
        }
      ]
    );
  };

  // 📄 සතාගේ රූපය සහිතව පරිපූර්ණ A4 නිමාවකින් PDF Report එකක් සෑදීම
  const generatePDFReport = async (reportText: string, dateStr: string, imgBase64: string) => {
    const imageTag = imgBase64 
      ? `<div class="img-container"><img src="data:image/jpeg;base64,${imgBase64}" /></div>` 
      : '';
    
    const htmlContent = `
      <html>
        <head>
          <style>
            @page {
              size: A4;
              margin: 20mm 15mm 20mm 15mm;
            }
            body { 
              font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; 
              color: #1e293b; 
              margin: 0;
              padding: 0;
              font-size: 14px;
              line-height: 1.6;
            }
            .header-section {
              text-align: center;
              margin-bottom: 25px;
            }
            .main-title { 
              color: #059669; 
              font-size: 28px; 
              font-weight: bold;
              margin: 0 0 5px 0; 
            }
            .sub-title { 
              text-align: center; 
              color: #64748b; 
              font-size: 14px;
              text-transform: uppercase;
              letter-spacing: 1px;
              margin: 0;
            }
            .divider {
              border: none;
              border-top: 2px solid #e2e8f0; 
              margin: 15px 0;
            }
            .meta-info {
              font-size: 13px;
              color: #475569;
              margin-bottom: 20px;
              background: #f1f5f9;
              padding: 8px 15px;
              border-radius: 6px;
              display: inline-block;
            }
            .img-container {
              text-align: center; 
              margin-bottom: 25px;
              page-break-inside: avoid;
            }
            .img-container img {
              width: 220px; 
              height: 220px;
              object-fit: cover;
              border-radius: 12px; 
              border: 3px solid #059669;
            }
            .report-box { 
              background: #ffffff; 
              padding: 5px 0;
              white-space: pre-wrap; 
            }
            .report-section {
              background: #f8fafc;
              border: 1px solid #e2e8f0;
              border-radius: 10px;
              padding: 15px 20px;
              margin-bottom: 15px;
              page-break-inside: avoid;
            }
            footer { 
              position: fixed;
              bottom: 0;
              left: 0;
              right: 0;
              text-align: center; 
              font-size: 11px; 
              color: #94a3b8; 
              border-top: 1px solid #e2e8f0;
              padding-top: 10px;
            }
          </style>
        </head>
        <body>
          <div class="header-section">
            <h1 class="main-title">🐕 PetCenter-AI</h1>
            <h3 class="sub-title">Pet Health Analysis Report</h3>
            <div class="divider"></div>
            <div class="meta-info"><strong>Date of Analysis:</strong> ${dateStr}</div>
          </div>

          ${imageTag}

          <div class="report-box">
            ${reportText.split('\n\n').map(section => {
              if (!section.trim()) return '';
              return `<div class="report-section">${section.replace(/\n/g, '<br>')}</div>`;
            }).join('')}
          </div>

          <footer>
            Developed by O.W.T.D.B.O. Jayathilaka • BTech IT 2026
          </footer>
        </body>
      </html>
    `;
    try {
      const { uri } = await Print.printToFileAsync({ html: htmlContent });
      await Sharing.shareAsync(uri);
    } catch (error) {
      Alert.alert("PDF Error", "Failed to generate PDF document.");
    }
  };

  // 🔗 Native Share Sheet එක මඟින් සරලව Text එකක් Share කිරීම (Fixed Error)
  const shareReportText = async (reportText: string) => {
    try {
      await Share.share({
        message: `🐕 PetCenter-AI Health Analysis Report:\n\n${reportText}`,
      });
    } catch (error: any) {
      Alert.alert("Sharing Error", error.message);
    }
  };

  const makeEmergencyCall = (phoneNumber: string) => {
    Linking.openURL(`tel:${phoneNumber}`);
  };

  if (!isLoggedIn) {
    return (
      <View style={styles.loginContainer}>
        <View style={styles.loginCard}>
          <Text style={styles.logoIcon}>🐕</Text>
          <Text style={styles.logoText}>PetCenter-AI</Text>
          <Text style={styles.subLogoText}>Dog Vision Health Portal</Text>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Customer Email Address</Text>
            <TextInput 
              style={styles.input} placeholder="e.g. name@gmail.com" placeholderTextColor="#94a3b8"
              value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address"
            />
          </View>
          <TouchableOpacity style={styles.loginButton} onPress={handleLogin} disabled={loginLoading}>
            {loginLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Secure Login 🔑</Text>}
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>🐕 PetCenter-AI</Text>
        <View style={styles.headerButtons}>
          <TouchableOpacity style={styles.navIconBtn} onPress={() => setShowVets(true)}>
            <Text style={{ fontSize: 18 }}>📞</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.navIconBtn, { backgroundColor: '#ef4444' }]} onPress={() => setIsLoggedIn(false)}>
            <Text style={{ fontSize: 12, color: '#fff', fontWeight: 'bold' }}>OUT</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollBody}>
        {/* Language Selection */}
        <View style={styles.cardRow}>
          <Text style={styles.cardLabel}>Report Language:</Text>
          <View style={styles.langToggleRow}>
            <TouchableOpacity style={[styles.langBtn, language === 'English' && styles.langBtnActive]} onPress={() => setLanguage('English')}>
              <Text style={[styles.langBtnText, language === 'English' && styles.langBtnTextActive]}>English</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.langBtn, language === 'Sinhala' && styles.langBtnActive]} onPress={() => setLanguage('Sinhala')}>
              <Text style={[styles.langBtnText, language === 'Sinhala' && styles.langBtnTextActive]}>සිංහල</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Main Camera Preview Container */}
        <View style={styles.photoContainer}>
          {image ? <Image source={{ uri: image }} style={styles.previewImage} /> : (
            <View style={{ alignItems: 'center' }}>
              <Text style={{ fontSize: 50 }}>📸</Text>
              <Text style={styles.photoPlaceholderText}>Capture Pet Specimen Image</Text>
            </View>
          )}
          <View style={styles.actionRow}>
            <TouchableOpacity style={styles.captureBtn} onPress={takePhoto}><Text style={styles.captureBtnText}>Camera 📷</Text></TouchableOpacity>
            <TouchableOpacity style={[styles.captureBtn, { backgroundColor: '#64748b' }]} onPress={pickImage}><Text style={styles.captureBtnText}>Gallery 🖼️</Text></TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity style={styles.analyzeBtn} onPress={handleAnalyze} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.analyzeBtnText}>Scan & Analyze Dog 🔎</Text>}
        </TouchableOpacity>

        {/* Current Active Scan Result Panel */}
        {result ? (
          <View style={styles.resultCard}>
            <View style={styles.resultHeaderRow}>
              <Text style={styles.resultHeader}>📋 Current Analysis Report</Text>
              <TouchableOpacity style={styles.iconActionBtn} onPress={() => generatePDFReport(result, new Date().toLocaleDateString(), base64Image)}>
                <Text style={{ fontSize: 13, color: '#0369a1', fontWeight: 'bold' }}>📄 Export PDF</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.resultText}>{result}</Text>
          </View>
        ) : null}

        {/* 📜 RECENT SCANS LOG LIST SECTION */}
        <Text style={styles.sectionTitle}>📜 Recent Scans History</Text>
        {historyLoading && recentScans.length === 0 ? (
          <ActivityIndicator color="#059669" />
        ) : (
          recentScans.map((item) => (
            <TouchableOpacity 
              key={item.id} 
              style={styles.historyCard} 
              onPress={() => loadHistoryItemToMainView(item)}
              activeOpacity={0.7}
            >
              {/* Top Row: Info Timestamp */}
              <View style={styles.historyHeaderRow}>
                <Text style={styles.historyDate}>⏰ {new Date(item.scanned_at).toLocaleString()}</Text>
                <Text style={styles.tapToViewBadge}>Tap to View 👁️</Text>
              </View>
              
              {/* Report Body Preview */}
              <Text style={styles.historyBodyText} numberOfLines={3}>{item.analysis_result}</Text>
              
              {/* Bottom Row: Separated Clean Action Buttons */}
              <View style={styles.historyActionsContainer}>
                <TouchableOpacity style={[styles.actionGridBtn, { backgroundColor: '#f1f5f9' }]} onPress={() => shareReportText(item.analysis_result)}>
                  <Text style={styles.actionBtnText}>🔗 Share Text</Text>
                </TouchableOpacity>
                
                <TouchableOpacity style={[styles.actionGridBtn, { backgroundColor: '#e0f2fe' }]} onPress={() => generatePDFReport(item.analysis_result, new Date(item.scanned_at).toLocaleDateString(), item.image_base64)}>
                  <Text style={[styles.actionBtnText, { color: '#0369a1' }]}>📄 PDF</Text>
                </TouchableOpacity>
                
                <TouchableOpacity style={[styles.actionGridBtn, { backgroundColor: '#fee2e2' }]} onPress={() => handleDeleteScan(item.id)}>
                  <Text style={[styles.actionBtnText, { color: '#b91c1c' }]}>🗑️ Delete</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      {/* Emergency Modal */}
      <Modal visible={showVets} transparent={true} animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>🚨 Emergency Vet Contacts</Text>
            <TouchableOpacity style={styles.vetCallRow} onPress={() => makeEmergencyCall('+94112582155')}>
              <View><Text style={styles.vetName}>Government Vet Hospital</Text><Text style={styles.vetDetails}>Colombo (011 258 2155)</Text></View>
              <Text style={styles.callBadge}>Call</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.closeModalBtn} onPress={() => setShowVets(false)}><Text style={styles.closeModalBtnText}>Close Window</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// 🎨 BRAND NEW CLEAN LAYOUT STYLING
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc', paddingTop: 50 },
  loginContainer: { flex: 1, backgroundColor: '#f1f5f9', justifyContent: 'center', alignItems: 'center', padding: 20 },
  loginCard: { width: '100%', backgroundColor: '#fff', borderRadius: 25, padding: 25, alignItems: 'center', elevation: 4 },
  logoIcon: { fontSize: 60, marginBottom: 5 },
  logoText: { fontSize: 26, fontWeight: '900', color: '#059669' },
  subLogoText: { fontSize: 12, color: '#94a3b8', marginBottom: 25 },
  inputGroup: { width: '100%', marginBottom: 20 },
  label: { fontSize: 12, fontWeight: '700', color: '#475569', marginBottom: 6 },
  input: { width: '100%', backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 12, padding: 12 },
  loginButton: { width: '100%', backgroundColor: '#059669', padding: 15, borderRadius: 12, alignItems: 'center' },
  buttonText: { color: '#fff', fontWeight: '700' },
  header: { height: 60, backgroundColor: '#059669', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, borderBottomLeftRadius: 20, borderBottomRightRadius: 20 },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: '800' },
  headerButtons: { flexDirection: 'row', gap: 10 },
  navIconBtn: { width: 36, height: 36, backgroundColor: '#fff', borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  scrollBody: { padding: 20, gap: 15 },
  cardRow: { backgroundColor: '#fff', padding: 15, borderRadius: 15, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: '#e2e8f0' },
  cardLabel: { fontSize: 14, fontWeight: '600', color: '#334155' },
  langToggleRow: { flexDirection: 'row', gap: 5 },
  langBtn: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8, backgroundColor: '#f1f5f9' },
  langBtnActive: { backgroundColor: '#059669' },
  langBtnText: { fontSize: 12, color: '#475569', fontWeight: '600' },
  langBtnTextActive: { color: '#fff' },
  photoContainer: { backgroundColor: '#ecfdf5', borderWidth: 2, borderStyle: 'dashed', borderColor: '#6ee7b7', borderRadius: 20, padding: 15, height: 220, justifyContent: 'center', alignItems: 'center', overflow: 'hidden', position: 'relative' },
  previewImage: { width: '100%', height: '100%', borderRadius: 15, position: 'absolute' },
  photoPlaceholderText: { fontSize: 13, color: '#047857', fontWeight: '600', marginTop: 8 },
  actionRow: { flexDirection: 'row', gap: 10, position: 'absolute', bottom: 15 },
  captureBtn: { backgroundColor: '#059669', paddingVertical: 10, paddingHorizontal: 16, borderRadius: 10 },
  captureBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  analyzeBtn: { backgroundColor: '#10b981', padding: 16, borderRadius: 15, alignItems: 'center' },
  analyzeBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  resultCard: { backgroundColor: '#fff', padding: 18, borderRadius: 15, borderWidth: 1, borderColor: '#e2e8f0' },
  resultHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#f1f5f9', paddingBottom: 8, marginBottom: 10 },
  resultHeader: { fontSize: 14, fontWeight: '700', color: '#047857' },
  iconActionBtn: { backgroundColor: '#e0f2fe', paddingVertical: 5, paddingHorizontal: 12, borderRadius: 8 },
  resultText: { fontSize: 13, color: '#334155', lineHeight: 20 },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: '#1e293b', marginTop: 10, marginBottom: 5 },
  
  // 📜 HISTORY LOG ITEM CARDS
  historyCard: { backgroundColor: '#fff', padding: 16, borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 12, elevation: 1 },
  historyHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#f1f5f9', paddingBottom: 8, marginBottom: 10 },
  historyDate: { fontSize: 12, fontWeight: '600', color: '#475569' },
  tapToViewBadge: { fontSize: 11, fontWeight: '700', color: '#059669', backgroundColor: '#d1fae5', paddingVertical: 2, paddingHorizontal: 8, borderRadius: 8 },
  historyBodyText: { fontSize: 13, color: '#64748b', lineHeight: 18, marginBottom: 12 },
  
  // 🎛️ NEW RE-ORDERED BUTTONS CONTAINER (BOTTOM ROW GRID)
  historyActionsContainer: { flexDirection: 'row', justifyContent: 'space-between', gap: 8, borderTopWidth: 1, borderTopColor: '#f1f5f9', paddingTop: 10 },
  actionGridBtn: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  actionBtnText: { fontSize: 12, fontWeight: '700', color: '#475569' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  modalContent: { backgroundColor: '#fff', borderRadius: 25, padding: 20, gap: 15 },
  modalTitle: { fontSize: 16, fontWeight: '700', color: '#1e293b' },
  vetCallRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12, backgroundColor: '#f8fafc', borderRadius: 12 },
  vetName: { fontSize: 14, fontWeight: '700', color: '#334155' },
  vetDetails: { fontSize: 11, color: '#64748b' },
  callBadge: { backgroundColor: '#d1fae5', color: '#065f46', paddingVertical: 4, paddingHorizontal: 10, borderRadius: 12, fontSize: 11, fontWeight: '700' },
  closeModalBtn: { backgroundColor: '#1e293b', padding: 12, borderRadius: 12, alignItems: 'center' },
  closeModalBtnText: { color: '#fff', fontWeight: '700' }
});