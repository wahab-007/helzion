import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:permission_handler/permission_handler.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  runApp(const SmartHelmetApp());
}

const _brandBlue = Color(0xFF2D28D7);
const _brandRed = Color(0xFFFF2D3D);
const _cardShadow = BoxShadow(
  color: Color(0x120F172A),
  blurRadius: 20,
  offset: Offset(0, 10),
);

class SmartHelmetApp extends StatefulWidget {
  const SmartHelmetApp({super.key});

  @override
  State<SmartHelmetApp> createState() => _SmartHelmetAppState();
}

class _SmartHelmetAppState extends State<SmartHelmetApp> {
  bool _darkMode = false;
  bool _loading = true;
  bool _startupPermissionsPromptSeen = false;

  @override
  void initState() {
    super.initState();
    _loadPrefs();
  }

  Future<void> _loadPrefs() async {
    final prefs = await SharedPreferences.getInstance();
    if (!mounted) return;
    setState(() {
      _darkMode = prefs.getBool('smartHelmet.darkMode') ?? false;
      _startupPermissionsPromptSeen = prefs.getBool('smartHelmet.permissionsPromptSeen') ?? false;
      _loading = false;
    });
  }

  Future<void> _setDarkMode(bool enabled) async {
    setState(() => _darkMode = enabled);
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool('smartHelmet.darkMode', enabled);
  }

  Future<void> _setPermissionsPromptSeen() async {
    setState(() => _startupPermissionsPromptSeen = true);
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool('smartHelmet.permissionsPromptSeen', true);
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      debugShowCheckedModeBanner: false,
      title: 'Smart Helmet',
      themeMode: _darkMode ? ThemeMode.dark : ThemeMode.light,
      theme: ThemeData(
        useMaterial3: true,
        brightness: Brightness.light,
        scaffoldBackgroundColor: const Color(0xFFF4F8FF),
        colorScheme: const ColorScheme.light(
          primary: Color(0xFF2D28D7),
          secondary: Color(0xFFFF5A76),
          surface: Color(0xFFFFFFFF),
        ),
        fontFamily: 'Roboto',
      ),
      darkTheme: ThemeData(
        useMaterial3: true,
        brightness: Brightness.dark,
        scaffoldBackgroundColor: const Color(0xFF07111F),
        colorScheme: const ColorScheme.dark(
          primary: Color(0xFF4F8EFF),
          secondary: Color(0xFFFF5A76),
          surface: Color(0xFF0D1A2D),
        ),
        fontFamily: 'Roboto',
      ),
      home: _loading
          ? const Scaffold(body: Center(child: CircularProgressIndicator()))
          : AppController(
              initialDarkMode: _darkMode,
              permissionsPromptSeen: _startupPermissionsPromptSeen,
              onDarkModeChanged: _setDarkMode,
              onPermissionsPromptSeen: _setPermissionsPromptSeen,
            ),
    );
  }
}

class RiderProfile {
  const RiderProfile({
    required this.name,
    required this.email,
    required this.phone,
    required this.helmetId,
    required this.language,
    required this.totalRides,
    required this.kmTravelled,
    required this.accidents,
  });

  final String name;
  final String email;
  final String phone;
  final String helmetId;
  final String language;
  final int totalRides;
  final int kmTravelled;
  final int accidents;

  RiderProfile copyWith({
    String? name,
    String? email,
    String? phone,
    String? helmetId,
    String? language,
    int? totalRides,
    int? kmTravelled,
    int? accidents,
  }) {
    return RiderProfile(
      name: name ?? this.name,
      email: email ?? this.email,
      phone: phone ?? this.phone,
      helmetId: helmetId ?? this.helmetId,
      language: language ?? this.language,
      totalRides: totalRides ?? this.totalRides,
      kmTravelled: kmTravelled ?? this.kmTravelled,
      accidents: accidents ?? this.accidents,
    );
  }
}

class AppSettingsData {
  const AppSettingsData({
    required this.darkMode,
    required this.pushNotifications,
    required this.gpsTracking,
    required this.autoConnect,
    required this.accidentSensitivity,
    required this.emergencyCountdown,
  });

  final bool darkMode;
  final bool pushNotifications;
  final bool gpsTracking;
  final bool autoConnect;
  final double accidentSensitivity;
  final double emergencyCountdown;

  AppSettingsData copyWith({
    bool? darkMode,
    bool? pushNotifications,
    bool? gpsTracking,
    bool? autoConnect,
    double? accidentSensitivity,
    double? emergencyCountdown,
  }) {
    return AppSettingsData(
      darkMode: darkMode ?? this.darkMode,
      pushNotifications: pushNotifications ?? this.pushNotifications,
      gpsTracking: gpsTracking ?? this.gpsTracking,
      autoConnect: autoConnect ?? this.autoConnect,
      accidentSensitivity: accidentSensitivity ?? this.accidentSensitivity,
      emergencyCountdown: emergencyCountdown ?? this.emergencyCountdown,
    );
  }
}

class AppPermissionState {
  const AppPermissionState({
    required this.notificationsGranted,
    required this.locationGranted,
  });

  final bool notificationsGranted;
  final bool locationGranted;
}

class AlertItem {
  const AlertItem({
    required this.title,
    required this.subtitle,
    required this.time,
    required this.color,
    required this.icon,
  });

  final String title;
  final String subtitle;
  final String time;
  final Color color;
  final IconData icon;
}

class LiveHelmetBundle {
  const LiveHelmetBundle({
    required this.profile,
    required this.status,
    required this.contacts,
    required this.accidents,
    required this.notifications,
  });

  final RiderProfile profile;
  final Map<String, dynamic> status;
  final List<Map<String, dynamic>> contacts;
  final List<Map<String, dynamic>> accidents;
  final List<AlertItem> notifications;
}

class SmartHelmetApi {
  SmartHelmetApi({http.Client? client}) : _client = client ?? http.Client();

  static const String baseUrl = 'https://helzion-server.onrender.com/api';
  final http.Client _client;

  Future<Map<String, dynamic>> login({required String email, required String password}) async {
    final response = await _client.post(
      Uri.parse('$baseUrl/auth/login'),
      headers: const {'Content-Type': 'application/json'},
      body: jsonEncode({'email': email, 'password': password}),
    );
    return _decodeJson(response);
  }

  Future<LiveHelmetBundle> loadBundle(String token) async {
    final results = await Future.wait([
      _safeGetJson('/user/me', token),
      _safeGetJson('/user/status', token),
      _safeGetJson('/user/contacts', token),
      _safeGetJson('/user/accidents', token),
      _safeGetJson('/user/notifications', token),
    ]);

    final profile = results[0] as Map<String, dynamic>? ?? const {};
    final status = results[1] as Map<String, dynamic>? ?? const {};
    final contacts = (results[2] as List? ?? const []).cast<Map<String, dynamic>>();
    final accidents = (results[3] as List? ?? const []).cast<Map<String, dynamic>>();
    final notifications = (results[4] as List? ?? const [])
        .map((item) {
          final map = item as Map<String, dynamic>;
          return AlertItem(
            title: map['message']?.toString() ?? '',
            subtitle: map['channel']?.toString() ?? '',
            time: _formatTimestamp(map['createdAt']?.toString()),
            color: _notificationColor(map['status']?.toString()),
            icon: _notificationIcon(map['channel']?.toString()),
          );
        })
        .toList();

    final statusData = (status['status'] as Map?)?.cast<String, dynamic>() ?? const {};
    final helmet = (status['helmet'] as Map?)?.cast<String, dynamic>() ?? const {};
    return LiveHelmetBundle(
      profile: RiderProfile(
        name: profile['fullName']?.toString() ?? '',
        email: profile['email']?.toString() ?? '',
        phone: profile['phoneNumber']?.toString() ?? '',
        helmetId: helmet['espId']?.toString() ?? '',
        language: '',
        totalRides: 0,
        kmTravelled: 0,
        accidents: accidents.length,
      ),
      status: {
        'online': statusData['online'] ?? status['online'],
        'batteryPercentage': statusData['batteryPercentage'] ?? status['batteryPercentage'],
        'gpsSignal': statusData['gpsSignal'] ?? status['gpsSignal'],
        'helmetWorn': statusData['helmetWorn'] ?? status['helmetWorn'],
        'ridingMode': status['ridingMode'] ?? helmet['ridingModeActive'],
        'helmet': helmet,
      },
      contacts: contacts,
      accidents: accidents,
      notifications: notifications,
    );
  }

  Future<dynamic> _safeGetJson(String path, String token) async {
    try {
      return await getJson(path, token);
    } catch (_) {
      return null;
    }
  }

  Future<dynamic> getJson(String path, String token) async {
    final response = await _client.get(
      Uri.parse('$baseUrl$path'),
      headers: {'Authorization': 'Bearer $token'},
    );
    return _decodeJson(response);
  }

  dynamic _decodeJson(http.Response response) {
    final body = response.body.isEmpty ? null : jsonDecode(response.body);
    if (response.statusCode >= 400) {
      final message = body is Map && body['message'] != null ? body['message'].toString() : 'Request failed';
      throw Exception(message);
    }
    return body;
  }
}

Color _notificationColor(String? status) {
  switch (status) {
    case 'sent':
      return const Color(0xFF23C55E);
    case 'failed':
      return const Color(0xFFFF5C5C);
    default:
      return const Color(0xFFF6C945);
  }
}

IconData _notificationIcon(String? channel) {
  switch (channel) {
    case 'whatsapp':
      return Icons.chat_bubble_outline;
    case 'email':
      return Icons.email_outlined;
    case 'push':
      return Icons.notifications_none;
    default:
      return Icons.sms_outlined;
  }
}

String _formatTimestamp(String? timestamp) {
  if (timestamp == null || timestamp.isEmpty) return '';
  final parsed = DateTime.tryParse(timestamp);
  if (parsed == null) return '';
  return '${parsed.hour.toString().padLeft(2, '0')}:${parsed.minute.toString().padLeft(2, '0')}';
}

class AppController extends StatefulWidget {
  const AppController({
    super.key,
    required this.initialDarkMode,
    required this.permissionsPromptSeen,
    required this.onDarkModeChanged,
    required this.onPermissionsPromptSeen,
  });

  final bool initialDarkMode;
  final bool permissionsPromptSeen;
  final ValueChanged<bool> onDarkModeChanged;
  final Future<void> Function() onPermissionsPromptSeen;

  @override
  State<AppController> createState() => _AppControllerState();
}

class _AppControllerState extends State<AppController> {
  bool _loggedIn = false;
  bool _loading = false;
  String _error = '';
  int _currentTab = 0;
  int _contactCount = 0;
  bool _showStartupPermissions = false;
  RiderProfile _profile = const RiderProfile(
    name: '',
    email: '',
    phone: '',
    helmetId: '',
    language: '',
    totalRides: 0,
    kmTravelled: 0,
    accidents: 0,
  );
  AppSettingsData _settings = const AppSettingsData(
    darkMode: false,
    pushNotifications: true,
    gpsTracking: true,
    autoConnect: true,
    accidentSensitivity: 0.7,
    emergencyCountdown: 15,
  );
  AppPermissionState _permissionState = const AppPermissionState(
    notificationsGranted: false,
    locationGranted: false,
  );
  List<AlertItem> _alerts = const [];
  Map<String, dynamic> _status = const {};
  final SmartHelmetApi _api = SmartHelmetApi();

  @override
  void initState() {
    super.initState();
    _settings = _settings.copyWith(darkMode: widget.initialDarkMode);
    _showStartupPermissions = !widget.permissionsPromptSeen;
    _loadSavedSettings();
    _refreshPermissionState();
  }

  Future<void> _loadSavedSettings() async {
    final prefs = await SharedPreferences.getInstance();
    if (!mounted) return;
    setState(() {
      _settings = AppSettingsData(
        darkMode: prefs.getBool('smartHelmet.darkMode') ?? widget.initialDarkMode,
        pushNotifications: prefs.getBool('smartHelmet.pushNotifications') ?? true,
        gpsTracking: prefs.getBool('smartHelmet.gpsTracking') ?? true,
        autoConnect: prefs.getBool('smartHelmet.autoConnect') ?? true,
        accidentSensitivity: prefs.getDouble('smartHelmet.accidentSensitivity') ?? 0.7,
        emergencyCountdown: prefs.getDouble('smartHelmet.emergencyCountdown') ?? 15,
      );
    });
    widget.onDarkModeChanged(_settings.darkMode);
  }

  Future<void> _refreshPermissionState() async {
    final notifications = await Permission.notification.status;
    final location = await Permission.locationWhenInUse.status;
    if (!mounted) return;
    setState(() {
      _permissionState = AppPermissionState(
        notificationsGranted: notifications.isGranted,
        locationGranted: location.isGranted,
      );
    });
  }

  Future<void> _login(String email, String password) async {
    setState(() {
      _loading = true;
      _error = '';
    });
    try {
      final auth = await _api.login(email: email, password: password);
      final token = auth['accessToken']?.toString();
      if (token == null || token.isEmpty) {
        throw Exception('Login succeeded but no access token was returned.');
      }
      final bundle = await _api.loadBundle(token);
      setState(() {
        _loggedIn = true;
        _profile = bundle.profile;
        _alerts = bundle.notifications;
        _status = bundle.status;
        _contactCount = bundle.contacts.length;
      });
    } catch (error) {
      setState(() => _error = error.toString().replaceFirst('Exception: ', ''));
    } finally {
      setState(() => _loading = false);
    }
  }

  void _logout() {
    setState(() {
      _loggedIn = false;
      _currentTab = 0;
      _alerts = const [];
      _status = const {};
      _contactCount = 0;
      _profile = const RiderProfile(
        name: '',
        email: '',
        phone: '',
        helmetId: '',
        language: '',
        totalRides: 0,
        kmTravelled: 0,
        accidents: 0,
      );
    });
  }

  void _updateProfile(RiderProfile profile) {
    setState(() => _profile = profile);
  }

  void _updateLanguage(String language) {
    setState(() => _profile = _profile.copyWith(language: language));
  }

  void _updateSettings(AppSettingsData settings) {
    setState(() => _settings = settings);
    widget.onDarkModeChanged(settings.darkMode);
    SharedPreferences.getInstance().then((prefs) {
      prefs.setBool('smartHelmet.darkMode', settings.darkMode);
      prefs.setBool('smartHelmet.pushNotifications', settings.pushNotifications);
      prefs.setBool('smartHelmet.gpsTracking', settings.gpsTracking);
      prefs.setBool('smartHelmet.autoConnect', settings.autoConnect);
      prefs.setDouble('smartHelmet.accidentSensitivity', settings.accidentSensitivity);
      prefs.setDouble('smartHelmet.emergencyCountdown', settings.emergencyCountdown);
    });
  }

  Future<void> _requestNotificationPermission() async {
    await Permission.notification.request();
    await _refreshPermissionState();
  }

  Future<void> _requestLocationPermission() async {
    await Permission.locationWhenInUse.request();
    await _refreshPermissionState();
  }

  Future<void> _openAppSettings() async {
    await openAppSettings();
    await _refreshPermissionState();
  }

  Future<void> _completeStartupPermissions() async {
    await widget.onPermissionsPromptSeen();
    if (!mounted) return;
    setState(() => _showStartupPermissions = false);
  }

  @override
  Widget build(BuildContext context) {
    if (_showStartupPermissions) {
      return PermissionPromptScreen(
        permissions: _permissionState,
        onRequestNotifications: _requestNotificationPermission,
        onRequestLocation: _requestLocationPermission,
        onOpenAppSettings: _openAppSettings,
        onContinue: _completeStartupPermissions,
      );
    }

    if (!_loggedIn) {
      return AuthFlow(onLoggedIn: _login, loading: _loading, errorText: _error);
    }

    return MainShell(
      currentTab: _currentTab,
      onTabChanged: (value) => setState(() => _currentTab = value),
      profile: _profile,
      settings: _settings,
      alerts: _alerts,
      status: _status,
      contactCount: _contactCount,
      onProfileChanged: _updateProfile,
      onLanguageChanged: _updateLanguage,
      onSettingsChanged: _updateSettings,
      onRequestNotificationPermission: _requestNotificationPermission,
      onRequestLocationPermission: _requestLocationPermission,
      onOpenAppSettings: _openAppSettings,
      permissions: _permissionState,
      onLogout: _logout,
    );
  }
}

class AuthFlow extends StatefulWidget {
  const AuthFlow({super.key, required this.onLoggedIn, required this.loading, required this.errorText});

  final Future<void> Function(String email, String password) onLoggedIn;
  final bool loading;
  final String errorText;

  @override
  State<AuthFlow> createState() => _AuthFlowState();
}

class _AuthFlowState extends State<AuthFlow> {
  bool _showRegister = false;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: AnimatedSwitcher(
          duration: const Duration(milliseconds: 250),
          child: _showRegister
              ? RegisterWizard(
                  key: const ValueKey('register'),
                  onBackToLogin: () => setState(() => _showRegister = false),
                  onComplete: () => setState(() => _showRegister = false),
                )
              : LoginScreen(
                  key: const ValueKey('login'),
                  onLogin: widget.onLoggedIn,
                  onRegisterTap: () => setState(() => _showRegister = true),
                  loading: widget.loading,
                  errorText: widget.errorText,
                ),
        ),
      ),
    );
  }
}

class PermissionPromptScreen extends StatelessWidget {
  const PermissionPromptScreen({
    super.key,
    required this.permissions,
    required this.onRequestNotifications,
    required this.onRequestLocation,
    required this.onOpenAppSettings,
    required this.onContinue,
  });

  final AppPermissionState permissions;
  final Future<void> Function() onRequestNotifications;
  final Future<void> Function() onRequestLocation;
  final Future<void> Function() onOpenAppSettings;
  final Future<void> Function() onContinue;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(18),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const SizedBox(height: 18),
              const AuthHeader(
                icon: Icons.security_outlined,
                title: 'Allow Permissions',
                subtitle: 'Enable notifications and location for live safety alerts.',
              ),
              const SizedBox(height: 20),
              _PermissionCard(
                title: 'Notification Permission',
                subtitle: permissions.notificationsGranted ? 'Already allowed' : 'Required for alerts',
                icon: Icons.notifications_active_outlined,
                granted: permissions.notificationsGranted,
                onRequest: onRequestNotifications,
                onOpenSettings: onOpenAppSettings,
              ),
              const SizedBox(height: 12),
              _PermissionCard(
                title: 'Location Permission',
                subtitle: permissions.locationGranted ? 'Already allowed' : 'Required for live tracking',
                icon: Icons.location_on_outlined,
                granted: permissions.locationGranted,
                onRequest: onRequestLocation,
                onOpenSettings: onOpenAppSettings,
              ),
              const SizedBox(height: 20),
              AppPrimaryButton(
                text: 'Continue to App',
                onPressed: () => onContinue(),
              ),
              const SizedBox(height: 12),
              AppSecondaryButton(
                text: 'Skip for Now',
                onPressed: () => onContinue(),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class LoginScreen extends StatefulWidget {
  const LoginScreen({
    super.key,
    required this.onLogin,
    required this.onRegisterTap,
    required this.loading,
    required this.errorText,
  });

  final Future<void> Function(String email, String password) onLogin;
  final VoidCallback onRegisterTap;
  final bool loading;
  final String errorText;

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final TextEditingController _emailController = TextEditingController();
  final TextEditingController _passwordController = TextEditingController();

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.only(bottom: 24),
      child: Column(
        children: [
          const AuthHeader(
            icon: Icons.health_and_safety_outlined,
            title: 'Welcome Back',
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(18, 20, 18, 0),
            child: Column(
              children: [
                AppTextField(
                  label: 'Email',
                  hint: 'Enter your email',
                  prefixIcon: Icons.mail_outline,
                  controller: _emailController,
                ),
                const SizedBox(height: 18),
                AppTextField(
                  label: 'Password',
                  hint: 'Enter your password',
                  prefixIcon: Icons.lock_outline,
                  suffixIcon: Icons.remove_red_eye_outlined,
                  obscure: true,
                  controller: _passwordController,
                ),
                const SizedBox(height: 16),
                Wrap(
                  alignment: WrapAlignment.spaceBetween,
                  crossAxisAlignment: WrapCrossAlignment.center,
                  spacing: 8,
                  runSpacing: 4,
                  children: [
                    const Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.check_box_outline_blank, size: 20, color: Color(0xFFD1D5DB)),
                        SizedBox(width: 8),
                        Text('Remember me', style: TextStyle(fontSize: 14, color: Color(0xFF6B7280))),
                      ],
                    ),
                    TextButton(
                      onPressed: () {},
                      child: const Text('Forgot password?'),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                if (widget.errorText.isNotEmpty) ...[
                  Text(widget.errorText, style: const TextStyle(color: Color(0xFFFF5C5C), fontWeight: FontWeight.w600)),
                  const SizedBox(height: 12),
                ],
                AppPrimaryButton(
                  text: widget.loading ? 'Signing In...' : 'Login',
                  onPressed: widget.loading
                      ? null
                      : () => widget.onLogin(
                            _emailController.text.trim(),
                            _passwordController.text,
                          ),
                ),
                const SizedBox(height: 24),
                const Row(
                  children: [
                    Expanded(child: Divider(color: Color(0xFFE5E7EB))),
                    Padding(
                      padding: EdgeInsets.symmetric(horizontal: 14),
                      child: Text('OR', style: TextStyle(color: Color(0xFF9CA3AF))),
                    ),
                    Expanded(child: Divider(color: Color(0xFFE5E7EB))),
                  ],
                ),
                const SizedBox(height: 22),
                Container(
                  height: 54,
                  decoration: BoxDecoration(
                    color: Theme.of(context).colorScheme.surfaceContainerHighest,
                    borderRadius: BorderRadius.circular(18),
                    border: Border.all(color: Theme.of(context).colorScheme.outlineVariant),
                  ),
                  child: Center(
                    child: Text(
                      'Email login only',
                      style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600, color: Theme.of(context).colorScheme.onSurface),
                    ),
                  ),
                ),
                const SizedBox(height: 28),
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const Text("Don't have an account? ", style: TextStyle(color: Color(0xFF6B7280))),
                    GestureDetector(
                      onTap: widget.onRegisterTap,
                      child: const Text(
                        'Register',
                        style: TextStyle(color: _brandBlue, fontWeight: FontWeight.w700),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class RegisterWizard extends StatefulWidget {
  const RegisterWizard({
    super.key,
    required this.onBackToLogin,
    required this.onComplete,
  });

  final VoidCallback onBackToLogin;
  final VoidCallback onComplete;

  @override
  State<RegisterWizard> createState() => _RegisterWizardState();
}

class _RegisterWizardState extends State<RegisterWizard> {
  int _step = 0;

  @override
  Widget build(BuildContext context) {
    final steps = ['Personal Info', 'Helmet Info', 'Emergency Contact', 'Review'];
    return SingleChildScrollView(
      padding: const EdgeInsets.only(bottom: 24),
      child: Column(
        children: [
          const AuthHeader(
            icon: Icons.health_and_safety_outlined,
            title: 'Create Account',
            subtitle: 'Join us for safer rides',
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(18, 14, 18, 0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: List.generate(steps.length, (index) {
                    final active = index <= _step;
                    return Expanded(
                      child: Row(
                        children: [
                          Container(
                            width: 28,
                            height: 28,
                            decoration: BoxDecoration(
                              color: active ? _brandBlue : const Color(0xFFE5E7EB),
                              shape: BoxShape.circle,
                            ),
                            child: Center(
                              child: Text(
                                '${index + 1}',
                                style: TextStyle(
                                  color: active ? Colors.white : const Color(0xFF6B7280),
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                            ),
                          ),
                          if (index < steps.length - 1)
                            Expanded(
                              child: Container(
                                height: 3,
                                margin: const EdgeInsets.symmetric(horizontal: 6),
                                decoration: BoxDecoration(
                                  color: index < _step ? _brandBlue : const Color(0xFFE5E7EB),
                                  borderRadius: BorderRadius.circular(20),
                                ),
                              ),
                            ),
                        ],
                      ),
                    );
                  }),
                ),
                const SizedBox(height: 8),
                Text(
                  steps[_step],
                  style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: Color(0xFF4B5563)),
                ),
                const SizedBox(height: 18),
                _RegisterStepCard(step: _step),
                const SizedBox(height: 18),
                Row(
                  children: [
                    if (_step > 0)
                      Expanded(
                        child: AppSecondaryButton(
                          text: 'Back',
                          onPressed: () => setState(() => _step -= 1),
                        ),
                      ),
                    if (_step > 0) const SizedBox(width: 12),
                    Expanded(
                      child: AppPrimaryButton(
                        text: _step == 3 ? 'Create Account' : 'Next',
                        onPressed: () {
                          if (_step == 3) {
                            widget.onComplete();
                          } else {
                            setState(() => _step += 1);
                          }
                        },
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 18),
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const Text('Already have an account? ', style: TextStyle(color: Color(0xFF6B7280))),
                    GestureDetector(
                      onTap: widget.onBackToLogin,
                      child: const Text(
                        'Login',
                        style: TextStyle(color: _brandBlue, fontWeight: FontWeight.w700),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _RegisterStepCard extends StatelessWidget {
  const _RegisterStepCard({required this.step});

  final int step;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(24),
        boxShadow: const [_cardShadow],
      ),
      child: Column(
        children: switch (step) {
          0 => const [
              AppTextField(label: 'Full Name', hint: 'Enter your full name', prefixIcon: Icons.person_outline),
              SizedBox(height: 16),
              AppTextField(label: 'Email', hint: 'Enter your email', prefixIcon: Icons.mail_outline),
              SizedBox(height: 16),
              AppTextField(label: 'Phone Number', hint: 'Enter your phone number', prefixIcon: Icons.phone_outlined),
              SizedBox(height: 16),
              AppTextField(label: 'Password', hint: 'Create a password', prefixIcon: Icons.lock_outline, suffixIcon: Icons.remove_red_eye_outlined, obscure: true),
              SizedBox(height: 16),
              AppTextField(label: 'Confirm Password', hint: 'Confirm your password', prefixIcon: Icons.lock_outline, suffixIcon: Icons.remove_red_eye_outlined, obscure: true),
            ],
          1 => const [
              AppTextField(label: 'Helmet ID', hint: 'HLM-123456789', prefixIcon: Icons.memory_outlined),
              SizedBox(height: 16),
              AppTextField(label: 'Secret Key', hint: 'ABC123XYZ', prefixIcon: Icons.vpn_key_outlined),
              SizedBox(height: 16),
              AppTextField(label: 'Helmet Name', hint: 'My Helmet', prefixIcon: Icons.health_and_safety_outlined),
              SizedBox(height: 16),
                const AppTextField(label: 'Helmet Model', hint: '', prefixIcon: Icons.sports_motorsports_outlined),
            ],
          2 => const [
              AppTextField(label: 'Contact Name', hint: 'John Doe', prefixIcon: Icons.person_outline),
              SizedBox(height: 16),
              AppTextField(label: 'Relationship', hint: 'Parent', prefixIcon: Icons.people_outline),
              SizedBox(height: 16),
              AppTextField(label: 'Phone Number', hint: '+92 300 1234567', prefixIcon: Icons.phone_outlined),
              SizedBox(height: 16),
              AppTextField(label: 'WhatsApp Number', hint: '+92 300 1234567', prefixIcon: Icons.chat_bubble_outline),
            ],
          _ => [
              _ReviewRow(label: 'Rider', value: 'Ahmed Khan'),
              _ReviewRow(label: 'Email', value: 'ahmed@example.com'),
                const _ReviewRow(label: 'Helmet ID', value: ''),
                const _ReviewRow(label: 'Helmet Model', value: ''),
              _ReviewRow(label: 'Emergency Contact', value: 'John Doe (+92 300 1234567)'),
            ],
        },
      ),
    );
  }
}

class _ReviewRow extends StatelessWidget {
  const _ReviewRow({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 10),
      child: Row(
        children: [
          Text(label, style: const TextStyle(color: Color(0xFF6B7280), fontWeight: FontWeight.w600)),
          const Spacer(),
          Flexible(
            child: Text(
              value,
              textAlign: TextAlign.right,
              style: const TextStyle(fontWeight: FontWeight.w700),
            ),
          ),
        ],
      ),
    );
  }
}

class MainShell extends StatefulWidget {
  const MainShell({
    super.key,
    required this.currentTab,
    required this.onTabChanged,
    required this.profile,
    required this.settings,
    required this.alerts,
    required this.status,
    required this.contactCount,
    required this.onProfileChanged,
    required this.onLanguageChanged,
    required this.onSettingsChanged,
    required this.onRequestNotificationPermission,
    required this.onRequestLocationPermission,
    required this.onOpenAppSettings,
    required this.permissions,
    required this.onLogout,
  });

  final int currentTab;
  final ValueChanged<int> onTabChanged;
  final RiderProfile profile;
  final AppSettingsData settings;
  final List<AlertItem> alerts;
  final Map<String, dynamic> status;
  final int contactCount;
  final ValueChanged<RiderProfile> onProfileChanged;
  final ValueChanged<String> onLanguageChanged;
  final ValueChanged<AppSettingsData> onSettingsChanged;
  final Future<void> Function() onRequestNotificationPermission;
  final Future<void> Function() onRequestLocationPermission;
  final Future<void> Function() onOpenAppSettings;
  final AppPermissionState permissions;
  final VoidCallback onLogout;

  @override
  State<MainShell> createState() => _MainShellState();
}

class _MainShellState extends State<MainShell> {
  @override
  Widget build(BuildContext context) {
    final pages = [
      HomeScreen(onOpenSettings: _openSettings, onOpenSos: _openSos, profile: widget.profile, alerts: widget.alerts, status: widget.status, contactCount: widget.contactCount),
      LiveTrackingScreen(status: widget.status),
      AlertsScreen(alerts: widget.alerts),
      ProfileScreen(
        profile: widget.profile,
        onEditProfile: _openEditProfile,
        onChangePassword: _openChangePassword,
        onLanguage: _openLanguage,
        onLogout: widget.onLogout,
      ),
    ];

    return Scaffold(
      body: SafeArea(
        child: IndexedStack(index: widget.currentTab, children: pages),
      ),
      bottomNavigationBar: Container(
        height: 90,
        decoration: BoxDecoration(
          color: Theme.of(context).colorScheme.surface,
          border: Border(top: BorderSide(color: Theme.of(context).colorScheme.outlineVariant)),
        ),
        child: Row(
          children: [
            _BottomItem(icon: Icons.home_outlined, activeIcon: Icons.home, label: 'Home', active: widget.currentTab == 0, onTap: () => widget.onTabChanged(0)),
            _BottomItem(icon: Icons.map_outlined, activeIcon: Icons.map, label: 'Map', active: widget.currentTab == 1, onTap: () => widget.onTabChanged(1)),
            _BottomItem(icon: Icons.notifications_none, activeIcon: Icons.notifications, label: 'Alerts', active: widget.currentTab == 2, onTap: () => widget.onTabChanged(2)),
            _BottomItem(icon: Icons.person_outline, activeIcon: Icons.person, label: 'Profile', active: widget.currentTab == 3, onTap: () => widget.onTabChanged(3)),
          ],
        ),
      ),
    );
  }

  Future<void> _openSettings() async {
    await Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => SettingsScreen(
          settings: widget.settings,
          onChanged: widget.onSettingsChanged,
          permissions: widget.permissions,
          onRequestNotificationPermission: widget.onRequestNotificationPermission,
          onRequestLocationPermission: widget.onRequestLocationPermission,
          onOpenAppSettings: widget.onOpenAppSettings,
        ),
      ),
    );
  }

  Future<void> _openEditProfile() async {
    final result = await Navigator.of(context).push<RiderProfile>(
      MaterialPageRoute(
        builder: (_) => EditProfileScreen(profile: widget.profile),
      ),
    );

    if (result != null) {
      widget.onProfileChanged(result);
    }
  }

  Future<void> _openChangePassword() async {
    await Navigator.of(context).push(
      MaterialPageRoute(builder: (_) => const ChangePasswordScreen()),
    );
  }

  Future<void> _openLanguage() async {
    final result = await Navigator.of(context).push<String>(
      MaterialPageRoute(
        builder: (_) => LanguageScreen(selectedLanguage: widget.profile.language),
      ),
    );

    if (result != null) {
      widget.onLanguageChanged(result);
    }
  }

  Future<void> _openSos() async {
    await Navigator.of(context).push(
      MaterialPageRoute(builder: (_) => const SosAlertScreen()),
    );
  }
}

class HomeScreen extends StatelessWidget {
  const HomeScreen({
    super.key,
    required this.onOpenSettings,
    required this.onOpenSos,
    required this.profile,
    required this.alerts,
    required this.status,
    required this.contactCount,
  });

  final VoidCallback onOpenSettings;
  final VoidCallback onOpenSos;
  final RiderProfile profile;
  final List<AlertItem> alerts;
  final Map<String, dynamic> status;
  final int contactCount;

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
      child: Column(
        children: [
          HomeHero(onOpenSettings: onOpenSettings, profile: profile, status: status),
          const SizedBox(height: 16),
          _FloatingStatusCard(status: status),
          const SizedBox(height: 16),
          _InfoGrid(contactsCount: contactCount),
          const SizedBox(height: 16),
          _BatteryCard(status: status),
          const SizedBox(height: 16),
          _LiveLocationCard(status: status),
          const SizedBox(height: 18),
          AppPrimaryButton(
            text: 'Emergency SOS',
            color: _brandRed,
            icon: Icons.warning_amber_rounded,
            onPressed: onOpenSos,
          ),
        ],
      ),
    );
  }
}

class HomeHero extends StatelessWidget {
  const HomeHero({super.key, required this.onOpenSettings, required this.profile, required this.status});

  final VoidCallback onOpenSettings;
  final RiderProfile profile;
  final Map<String, dynamic> status;

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 196,
      width: double.infinity,
      decoration: const BoxDecoration(
        color: _brandBlue,
        borderRadius: BorderRadius.only(
          bottomLeft: Radius.circular(30),
          bottomRight: Radius.circular(30),
        ),
      ),
      child: Stack(
        children: [
          Positioned(
            top: -12,
            left: -28,
            child: Container(
              width: 120,
              height: 120,
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.05),
                shape: BoxShape.circle,
              ),
            ),
          ),
          Positioned(
            top: -30,
            right: -8,
            child: Container(
              width: 140,
              height: 140,
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.05),
                shape: BoxShape.circle,
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(18, 18, 18, 20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text('Hello Rider', style: TextStyle(color: Color(0xFFD9DBFF), fontSize: 12)),
                          const SizedBox(height: 4),
                          Text(
                            profile.name.isEmpty ? 'Stay Safe Today' : 'Welcome, ${profile.name.split(' ').first}',
                            style: const TextStyle(color: Colors.white, fontSize: 28, fontWeight: FontWeight.w700),
                          ),
                        ],
                      ),
                    ),
                    GestureDetector(
                      onTap: onOpenSettings,
                      child: Container(
                        width: 42,
                        height: 42,
                        decoration: BoxDecoration(
                          color: Colors.white.withValues(alpha: 0.12),
                          borderRadius: BorderRadius.circular(16),
                        ),
                        child: const Icon(Icons.settings_outlined, color: Colors.white),
                      ),
                    ),
                  ],
                ),
                const Spacer(),
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.08),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Row(
                    children: [
                      const _MiniHeroIcon(icon: Icons.health_and_safety_outlined),
                      const SizedBox(width: 14),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text('Helmet Status', style: TextStyle(color: Color(0xFFD9DBFF), fontSize: 12)),
                            const SizedBox(height: 3),
                            Text(
                              status['online'] == null ? '' : (status['online'] == true ? 'Connected' : 'Disconnected'),
                              style: const TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.w700),
                            ),
                          ],
                        ),
                      ),
                      const Icon(Icons.circle, color: Color(0xFF1FE36D), size: 10),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _MiniHeroIcon extends StatelessWidget {
  const _MiniHeroIcon({required this.icon});

  final IconData icon;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 46,
      height: 46,
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Icon(icon, color: Colors.white),
    );
  }
}

class _FloatingStatusCard extends StatelessWidget {
  const _FloatingStatusCard({required this.status});

  final Map<String, dynamic> status;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Text('Current Status', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
              const Spacer(),
              _StatusChip(text: status['online'] == null ? '' : (status['online'] == true ? 'Safe' : 'Check'), color: const Color(0xFFE7FBEF), textColor: const Color(0xFF22C55E)),
            ],
          ),
          const SizedBox(height: 14),
          Row(
            children: [
              const Icon(Icons.shield_outlined, color: Color(0xFF22C55E), size: 30),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(status['online'] == null ? '' : (status['online'] == true ? 'All systems operational' : 'Connection unstable'), style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
                    const SizedBox(height: 2),
                    Text(status['gpsSignal'] == null ? '' : (status['gpsSignal'] == true ? 'GPS signal available' : 'GPS signal unavailable'), style: const TextStyle(color: Color(0xFF6B7280))),
                  ],
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _InfoGrid extends StatelessWidget {
  const _InfoGrid({required this.contactsCount});

  final int contactsCount;

  @override
  Widget build(BuildContext context) {
    return GridView.count(
      crossAxisCount: 2,
      mainAxisSpacing: 14,
      crossAxisSpacing: 14,
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      childAspectRatio: 1.35,
      children: [
        const _GridInfoCard(icon: Icons.bluetooth_connected, iconColor: Color(0xFF1FE36D), title: 'Bluetooth', value: ''),
        const _GridInfoCard(icon: Icons.sensors, iconColor: Color(0xFF22C55E), title: 'Helmet Sensor', value: ''),
        const _GridInfoCard(icon: Icons.flash_on_rounded, iconColor: Color(0xFF22C55E), title: 'Shock Sensor', value: ''),
        _GridInfoCard(icon: Icons.people_outline, iconColor: const Color(0xFF4F8EFF), title: 'Emergency Contact', value: contactsCount == 0 ? '' : '$contactsCount Added'),
      ],
    );
  }
}

class _GridInfoCard extends StatelessWidget {
  const _GridInfoCard({
    required this.icon,
    required this.iconColor,
    required this.title,
    required this.value,
  });

  final IconData icon;
  final Color iconColor;
  final String title;
  final String value;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 42,
            height: 42,
            decoration: BoxDecoration(
              color: iconColor.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(14),
            ),
            child: Icon(icon, color: iconColor),
          ),
          const Spacer(),
          Text(title, style: const TextStyle(color: Color(0xFF6B7280), fontSize: 13)),
          const SizedBox(height: 4),
          Text(value, style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: iconColor)),
        ],
      ),
    );
  }
}

class _BatteryCard extends StatelessWidget {
  const _BatteryCard({required this.status});

  final Map<String, dynamic> status;

  @override
  Widget build(BuildContext context) {
    final battery = status['batteryPercentage'];
    final batteryValue = battery is num ? battery.toDouble() / 100.0 : null;
    return AppCard(
      child: Column(
        children: [
          Row(
            children: [
              Icon(Icons.battery_5_bar_rounded, color: Color(0xFF4F8EFF), size: 30),
              SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Device Battery', style: TextStyle(color: Color(0xFF6B7280))),
                    SizedBox(height: 2),
                    Text(battery == null ? '' : '$battery%', style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w700)),
                  ],
                ),
              ),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text('Estimated', style: TextStyle(color: Color(0xFF6B7280))),
                  SizedBox(height: 2),
                  Text(battery == null ? '' : 'Live', style: const TextStyle(fontWeight: FontWeight.w700)),
                ],
              ),
            ],
          ),
          SizedBox(height: 16),
          ClipRRect(
            borderRadius: BorderRadius.all(Radius.circular(30)),
            child: LinearProgressIndicator(
              value: batteryValue,
              minHeight: 8,
              backgroundColor: Color(0xFFE7EBFF),
              valueColor: AlwaysStoppedAnimation<Color>(_brandBlue),
            ),
          ),
        ],
      ),
    );
  }
}

class _LiveLocationCard extends StatelessWidget {
  const _LiveLocationCard({required this.status});

  final Map<String, dynamic> status;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Text('Live Location', style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700)),
              Spacer(),
              Icon(Icons.graphic_eq_rounded, color: Color(0xFF1FE36D)),
            ],
          ),
          SizedBox(height: 14),
          _MapPlaceholder(height: 120),
          SizedBox(height: 10),
          Row(
            children: [
              Text('GPS Accuracy: ', style: TextStyle(color: Color(0xFF6B7280))),
              Text(status['gpsSignal'] == null ? '' : (status['gpsSignal'] == true ? 'High' : ''), style: TextStyle(color: Color(0xFF22C55E), fontWeight: FontWeight.w700)),
            ],
          ),
        ],
      ),
    );
  }
}

class LiveTrackingScreen extends StatelessWidget {
  const LiveTrackingScreen({super.key, required this.status});

  final Map<String, dynamic> status;

  @override
  Widget build(BuildContext context) {
    return Container(
      color: const Color(0xFFEAF5F5),
      child: Stack(
        children: [
          Positioned.fill(
            child: CustomPaint(painter: MapGridPainter()),
          ),
          SafeArea(
            child: Column(
              children: [
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 14, 16, 0),
                  child: Row(
                    children: [
                      const CircleAvatar(
                        radius: 24,
                        backgroundColor: Color(0xFFF1F5F9),
                        child: Icon(Icons.arrow_back, color: Color(0xFF1F2937), size: 18),
                      ),
                      const Expanded(
                        child: Center(
                          child: Text(
                            'Live Tracking',
                            style: TextStyle(fontSize: 22, fontWeight: FontWeight.w700),
                          ),
                        ),
                      ),
                      Container(
                        width: 48,
                        height: 48,
                        decoration: const BoxDecoration(
                          color: _brandBlue,
                          borderRadius: BorderRadius.all(Radius.circular(18)),
                        ),
                        child: const Icon(Icons.share_outlined, color: Colors.white),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 26),
                Expanded(
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 18),
                    child: Column(
                      children: [
                        Align(
                          alignment: Alignment.centerRight,
                          child: Container(
                            width: 58,
                            height: 58,
                            decoration: BoxDecoration(
                              color: const Color(0xFF12C85F),
                              borderRadius: BorderRadius.circular(20),
                            ),
                            child: const Icon(Icons.graphic_eq_rounded, color: Colors.white, size: 30),
                          ),
                        ),
                        const SizedBox(height: 18),
                        AppCard(
                          borderRadius: 28,
                          padding: const EdgeInsets.all(18),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                children: [
                                  Container(
                                    width: 56,
                                    height: 56,
                                    decoration: BoxDecoration(
                                      color: const Color(0xFFEEF4FF),
                                      borderRadius: BorderRadius.circular(18),
                                    ),
                                    child: const Icon(Icons.near_me_outlined, color: Color(0xFF3B82F6), size: 30),
                                  ),
                                  const SizedBox(width: 14),
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        const Text('Current Location', style: TextStyle(color: Color(0xFF6B7280), fontSize: 14)),
                                        SizedBox(height: 4),
                                        Text(status['location']?.toString() ?? '', style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w700)),
                                        SizedBox(height: 4),
                                        Text(status['coordinates']?.toString() ?? '', style: const TextStyle(color: Color(0xFF6B7280))),
                                      ],
                                    ),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 20),
                              Row(
                                children: [
                                  Expanded(child: _MetricColumn(label: 'Distance', value: status['distance']?.toString() ?? '')),
                                  Expanded(child: _MetricColumn(label: 'Duration', value: status['duration']?.toString() ?? '')),
                                  Expanded(child: _MetricColumn(label: 'Accuracy', value: status['gpsSignal'] == null ? '' : (status['gpsSignal'] == true ? 'High' : ''), valueColor: const Color(0xFF16A34A))),
                                ],
                              ),
                              const SizedBox(height: 18),
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 18),
                                decoration: BoxDecoration(
                                  color: const Color(0xFFF7F8FC),
                                  borderRadius: BorderRadius.circular(18),
                                ),
                                child: Row(
                                  children: [
                                    const Icon(Icons.access_time_rounded, size: 28, color: Color(0xFF6B7280)),
                                    const SizedBox(width: 12),
                                    Expanded(
                                      child: Text(status['eta']?.toString() ?? '', style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w600)),
                                    ),
                                    Text(status['etaTime']?.toString() ?? '', style: const TextStyle(color: _brandBlue, fontSize: 18, fontWeight: FontWeight.w700)),
                                  ],
                                ),
                              ),
                              const SizedBox(height: 18),
                              Row(
                                children: [
                                  Expanded(
                                    child: AppPrimaryButton(
                                      text: 'Share Location',
                                      icon: Icons.share_outlined,
                                      onPressed: () {},
                                    ),
                                  ),
                                  const SizedBox(width: 14),
                                  Container(
                                    width: 62,
                                    height: 62,
                                    decoration: BoxDecoration(
                                      color: _brandRed,
                                      borderRadius: BorderRadius.circular(20),
                                    ),
                                    child: const Icon(Icons.warning_amber_rounded, color: Colors.white),
                                  ),
                                ],
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _MetricColumn extends StatelessWidget {
  const _MetricColumn({
    required this.label,
    required this.value,
    this.valueColor,
  });

  final String label;
  final String value;
  final Color? valueColor;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: const TextStyle(color: Color(0xFF6B7280))),
        const SizedBox(height: 8),
        Text(
          value,
          style: TextStyle(
            fontSize: 18,
            fontWeight: FontWeight.w700,
            color: valueColor,
          ),
        ),
      ],
    );
  }
}

class AlertsScreen extends StatelessWidget {
  const AlertsScreen({super.key, required this.alerts});

  final List<AlertItem> alerts;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        const InnerBlueHeader(
          title: 'Notifications',
          showBack: false,
          child: SizedBox.shrink(),
        ),
        if (alerts.isNotEmpty)
          Container(
            margin: const EdgeInsets.fromLTRB(16, 14, 16, 0),
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
            decoration: BoxDecoration(
              color: _brandBlue.withValues(alpha: 0.85),
              borderRadius: BorderRadius.circular(18),
            ),
            child: Row(
              children: [
                const Icon(Icons.circle, color: Color(0xFFFF5C5C), size: 10),
                const SizedBox(width: 10),
                Expanded(
                  child: Text('${alerts.length} notifications', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w600)),
                ),
              ],
            ),
          ),
        Expanded(
          child: ListView.builder(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 30),
            itemCount: alerts.length,
            itemBuilder: (context, index) {
              final item = alerts[index];
              return Container(
                margin: const EdgeInsets.only(bottom: 14),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(22),
                  boxShadow: const [_cardShadow],
                ),
                child: ListTile(
                  contentPadding: const EdgeInsets.symmetric(horizontal: 18, vertical: 10),
                  leading: Container(
                    width: 48,
                    height: 48,
                    decoration: BoxDecoration(
                      color: item.color.withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(16),
                    ),
                    child: Icon(item.icon, color: item.color),
                  ),
                  title: Text(item.title, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
                  subtitle: Padding(
                    padding: const EdgeInsets.only(top: 6),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(item.subtitle, style: const TextStyle(color: Color(0xFF6B7280))),
                        const SizedBox(height: 8),
                        Row(
                          children: [
                            const Icon(Icons.access_time_rounded, size: 14, color: Color(0xFF9CA3AF)),
                            const SizedBox(width: 6),
                            Text(item.time, style: const TextStyle(color: Color(0xFF9CA3AF), fontSize: 12)),
                          ],
                        ),
                      ],
                    ),
                  ),
                ),
              );
            },
          ),
        ),
      ],
    );
  }
}

class ProfileScreen extends StatelessWidget {
  const ProfileScreen({
    super.key,
    required this.profile,
    required this.onEditProfile,
    required this.onChangePassword,
    required this.onLanguage,
    required this.onLogout,
  });

  final RiderProfile profile;
  final VoidCallback onEditProfile;
  final VoidCallback onChangePassword;
  final VoidCallback onLanguage;
  final VoidCallback onLogout;

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
      child: Column(
        children: [
          ProfileHeader(profile: profile),
          const SizedBox(height: 16),
          AppCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('Account Information', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 17)),
                const SizedBox(height: 16),
                _ProfileInfoRow(icon: Icons.mail_outline, color: const Color(0xFF4F8EFF), label: 'Email', value: profile.email),
                _ProfileInfoRow(icon: Icons.phone_outlined, color: const Color(0xFF22C55E), label: 'Phone Number', value: profile.phone),
                _ProfileInfoRow(icon: Icons.health_and_safety_outlined, color: const Color(0xFFC084FC), label: 'Helmet ID', value: profile.helmetId),
              ],
            ),
          ),
          const SizedBox(height: 16),
          _ProfileActionCard(
            icon: Icons.edit_outlined,
            color: const Color(0xFF60A5FA),
            title: 'Edit Profile',
            subtitle: 'Update your personal information',
            onTap: onEditProfile,
          ),
          const SizedBox(height: 12),
          _ProfileActionCard(
            icon: Icons.lock_outline,
            color: const Color(0xFF22C55E),
            title: 'Change Password',
            subtitle: 'Update your account password',
            onTap: onChangePassword,
          ),
          const SizedBox(height: 12),
          _ProfileActionCard(
            icon: Icons.language,
            color: const Color(0xFFC084FC),
            title: 'Language',
            subtitle: profile.language,
            onTap: onLanguage,
          ),
          const SizedBox(height: 16),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              color: _brandBlue,
              borderRadius: BorderRadius.circular(22),
              boxShadow: const [_cardShadow],
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('Ride Statistics', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 17)),
                const SizedBox(height: 16),
                Row(
                  children: [
                    Expanded(child: _StatMetric(number: '${profile.totalRides}', label: 'Total Rides')),
                    Expanded(child: _StatMetric(number: '${profile.kmTravelled}', label: 'Km Travelled')),
                    Expanded(child: _StatMetric(number: '${profile.accidents}', label: 'Accidents')),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: 18),
          AppPrimaryButton(
            text: 'Logout',
            color: _brandRed,
            icon: Icons.logout,
            onPressed: onLogout,
          ),
          const SizedBox(height: 16),
          const Text('App Version 2.4.1', style: TextStyle(color: Color(0xFF9CA3AF))),
        ],
      ),
    );
  }
}

class ProfileHeader extends StatelessWidget {
  const ProfileHeader({super.key, required this.profile});

  final RiderProfile profile;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      height: 220,
      decoration: const BoxDecoration(
        color: _brandBlue,
        borderRadius: BorderRadius.only(
          bottomLeft: Radius.circular(30),
          bottomRight: Radius.circular(30),
        ),
      ),
      child: Stack(
        children: [
          Positioned(
            top: -10,
            left: -25,
            child: Container(
              width: 120,
              height: 120,
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.05),
                shape: BoxShape.circle,
              ),
            ),
          ),
          Positioned(
            top: -24,
            right: -8,
            child: Container(
              width: 120,
              height: 120,
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.05),
                shape: BoxShape.circle,
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 22),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Row(
                  children: [
                    CircleAvatar(
                      radius: 18,
                      backgroundColor: Color(0x1FFFFFFF),
                      child: Icon(Icons.arrow_back, color: Colors.white, size: 18),
                    ),
                    SizedBox(width: 12),
                    Text('Profile', style: TextStyle(color: Colors.white, fontSize: 24, fontWeight: FontWeight.w700)),
                  ],
                ),
                const Spacer(),
                Center(
                  child: Column(
                    children: [
                      Stack(
                        children: [
                          Container(
                            width: 88,
                            height: 88,
                            decoration: BoxDecoration(
                              color: Colors.white.withValues(alpha: 0.14),
                              shape: BoxShape.circle,
                            ),
                            child: const Icon(Icons.person_outline, color: Colors.white, size: 44),
                          ),
                          Positioned(
                            right: 0,
                            bottom: 0,
                            child: Container(
                              width: 28,
                              height: 28,
                              decoration: BoxDecoration(
                                color: Colors.white,
                                borderRadius: BorderRadius.circular(14),
                              ),
                              child: const Icon(Icons.camera_alt_outlined, color: _brandBlue, size: 16),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 14),
                      Text(profile.name, style: const TextStyle(color: Colors.white, fontSize: 22, fontWeight: FontWeight.w700)),
                      const SizedBox(height: 4),
                      const Text('', style: TextStyle(color: Color(0xFFD9DBFF))),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _ProfileInfoRow extends StatelessWidget {
  const _ProfileInfoRow({
    required this.icon,
    required this.color,
    required this.label,
    required this.value,
  });

  final IconData icon;
  final Color color;
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 10),
      child: Row(
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(14),
            ),
            child: Icon(icon, color: color, size: 20),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(label, style: const TextStyle(color: Color(0xFF9CA3AF), fontSize: 12)),
                const SizedBox(height: 2),
                Text(value, style: const TextStyle(fontWeight: FontWeight.w600)),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _ProfileActionCard extends StatelessWidget {
  const _ProfileActionCard({
    required this.icon,
    required this.color,
    required this.title,
    required this.subtitle,
    required this.onTap,
  });

  final IconData icon;
  final Color color;
  final String title;
  final String subtitle;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(20),
      child: AppCard(
        child: Row(
          children: [
            Container(
              width: 42,
              height: 42,
              decoration: BoxDecoration(
                color: color.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(14),
              ),
              child: Icon(icon, color: color),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
                  const SizedBox(height: 4),
                  Text(subtitle, style: const TextStyle(color: Color(0xFF6B7280))),
                ],
              ),
            ),
            const Icon(Icons.arrow_forward_ios_rounded, size: 16, color: Color(0xFF9CA3AF)),
          ],
        ),
      ),
    );
  }
}

class _StatMetric extends StatelessWidget {
  const _StatMetric({required this.number, required this.label});

  final String number;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Text(number, style: const TextStyle(color: Colors.white, fontSize: 28, fontWeight: FontWeight.w700)),
        const SizedBox(height: 6),
        Text(label, style: const TextStyle(color: Color(0xFFD9DBFF), fontSize: 12)),
      ],
    );
  }
}

class SettingsScreen extends StatefulWidget {
  const SettingsScreen({
    super.key,
    required this.settings,
    required this.onChanged,
    required this.permissions,
    required this.onRequestNotificationPermission,
    required this.onRequestLocationPermission,
    required this.onOpenAppSettings,
  });

  final AppSettingsData settings;
  final ValueChanged<AppSettingsData> onChanged;
  final AppPermissionState permissions;
  final Future<void> Function() onRequestNotificationPermission;
  final Future<void> Function() onRequestLocationPermission;
  final Future<void> Function() onOpenAppSettings;

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  late AppSettingsData _settings;

  @override
  void initState() {
    super.initState();
    _settings = widget.settings;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
          child: Column(
            children: [
              const InnerBlueHeader(title: 'Settings'),
              const SizedBox(height: 16),
              _settingsSectionLabel('Appearance'),
              _SwitchCard(
                title: 'Dark Mode',
                subtitle: 'Enable dark theme',
                icon: Icons.dark_mode_outlined,
                iconColor: const Color(0xFF60A5FA),
                value: _settings.darkMode,
                onChanged: (value) {
                  final nextSettings = _settings.copyWith(darkMode: value);
                  setState(() => _settings = nextSettings);
                  widget.onChanged(nextSettings);
                },
              ),
              const SizedBox(height: 14),
              _settingsSectionLabel('Alerts & Notifications'),
              _PermissionCard(
                title: 'Notification Permission',
                subtitle: widget.permissions.notificationsGranted ? 'Allowed' : 'Not allowed',
                icon: Icons.notifications_active_outlined,
                granted: widget.permissions.notificationsGranted,
                onRequest: widget.onRequestNotificationPermission,
                onOpenSettings: widget.onOpenAppSettings,
              ),
              const SizedBox(height: 12),
              _SwitchCard(
                title: 'Push Notifications',
                subtitle: 'Receive alerts and updates',
                icon: Icons.notifications_none,
                iconColor: const Color(0xFF60A5FA),
                value: _settings.pushNotifications,
                onChanged: (value) => setState(() => _settings = _settings.copyWith(pushNotifications: value)),
              ),
              const SizedBox(height: 14),
              _settingsSectionLabel('Device Settings'),
              _PermissionCard(
                title: 'Location Permission',
                subtitle: widget.permissions.locationGranted ? 'Allowed' : 'Not allowed',
                icon: Icons.location_on_outlined,
                granted: widget.permissions.locationGranted,
                onRequest: widget.onRequestLocationPermission,
                onOpenSettings: widget.onOpenAppSettings,
              ),
              const SizedBox(height: 12),
              _SwitchCard(
                title: 'GPS Tracking',
                subtitle: 'Track your location in real-time',
                icon: Icons.location_on_outlined,
                iconColor: const Color(0xFF60A5FA),
                value: _settings.gpsTracking,
                onChanged: (value) => setState(() => _settings = _settings.copyWith(gpsTracking: value)),
              ),
              const SizedBox(height: 12),
              _SwitchCard(
                title: 'Auto Connect',
                subtitle: 'Connect to helmet automatically',
                icon: Icons.bluetooth_connected,
                iconColor: const Color(0xFF60A5FA),
                value: _settings.autoConnect,
                onChanged: (value) => setState(() => _settings = _settings.copyWith(autoConnect: value)),
              ),
              const SizedBox(height: 14),
              _settingsSectionLabel('Safety'),
              _SliderCard(
                title: 'Accident Sensitivity',
                subtitle: 'Current: ${(_settings.accidentSensitivity * 100).round()}%',
                icon: Icons.flash_on_rounded,
                iconColor: const Color(0xFFFF8A3D),
                value: _settings.accidentSensitivity,
                min: 0,
                max: 1,
                labels: const ['Low', 'Medium', 'High'],
                onChanged: (value) => setState(() => _settings = _settings.copyWith(accidentSensitivity: value)),
              ),
              const SizedBox(height: 12),
              _SliderCard(
                title: 'Emergency Countdown',
                subtitle: 'Current: ${_settings.emergencyCountdown.round()} seconds',
                icon: Icons.timelapse_outlined,
                iconColor: const Color(0xFFFF5C5C),
                value: _settings.emergencyCountdown,
                min: 5,
                max: 30,
                labels: const ['5s', '15s', '30s'],
                onChanged: (value) => setState(() => _settings = _settings.copyWith(emergencyCountdown: value)),
              ),
              const SizedBox(height: 14),
              _settingsSectionLabel('Privacy & Legal'),
              const _SettingsLinkCard(title: 'Privacy Policy', subtitle: 'View our privacy terms', icon: Icons.shield_outlined, iconColor: Color(0xFF22C55E)),
              const SizedBox(height: 12),
              const _SettingsLinkCard(title: 'About App', subtitle: 'Version 2.4.1 • Build 142', icon: Icons.info_outline, iconColor: Color(0xFFC084FC)),
              const SizedBox(height: 18),
              AppPrimaryButton(
                text: 'Save Settings',
                onPressed: () {
                  widget.onChanged(_settings);
                  Navigator.of(context).pop();
                },
              ),
              const SizedBox(height: 14),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.symmetric(vertical: 14),
                decoration: BoxDecoration(
                  color: const Color(0xFFEAF2FF),
                  borderRadius: BorderRadius.circular(18),
                  border: Border.all(color: const Color(0xFFD5E4FF)),
                ),
                child: const Center(
                  child: Text(
                    'All settings are saved automatically',
                    style: TextStyle(color: Color(0xFF6382C4), fontWeight: FontWeight.w600),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _settingsSectionLabel(String text) {
    return Align(
      alignment: Alignment.centerLeft,
      child: Padding(
        padding: const EdgeInsets.only(left: 4, bottom: 8),
        child: Text(
          text,
          style: const TextStyle(color: Color(0xFF6B7280), fontWeight: FontWeight.w600),
        ),
      ),
    );
  }
}

class _PermissionCard extends StatelessWidget {
  const _PermissionCard({
    required this.title,
    required this.subtitle,
    required this.icon,
    required this.granted,
    required this.onRequest,
    required this.onOpenSettings,
  });

  final String title;
  final String subtitle;
  final IconData icon;
  final bool granted;
  final Future<void> Function() onRequest;
  final Future<void> Function() onOpenSettings;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return AppCard(
      child: LayoutBuilder(
        builder: (context, constraints) {
          final compact = constraints.maxWidth < 360;
          return Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    width: 42,
                    height: 42,
                    decoration: BoxDecoration(
                      color: granted ? const Color(0x1A22C55E) : const Color(0x1AF59E0B),
                      borderRadius: BorderRadius.circular(14),
                    ),
                    child: Icon(icon, color: granted ? const Color(0xFF16A34A) : const Color(0xFFD97706)),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(title, style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16, color: scheme.onSurface)),
                        const SizedBox(height: 4),
                        Text(subtitle, style: TextStyle(color: scheme.onSurfaceVariant)),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                alignment: WrapAlignment.end,
                children: [
                  TextButton(onPressed: onRequest, child: const Text('Allow')),
                  TextButton(onPressed: onOpenSettings, child: const Text('Settings')),
                ],
              ),
              if (compact) const SizedBox(height: 2),
            ],
          );
        },
      ),
    );
  }
}

class _SwitchCard extends StatelessWidget {
  const _SwitchCard({
    required this.title,
    required this.subtitle,
    required this.icon,
    required this.iconColor,
    required this.value,
    required this.onChanged,
  });

  final String title;
  final String subtitle;
  final IconData icon;
  final Color iconColor;
  final bool value;
  final ValueChanged<bool> onChanged;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      child: Row(
        children: [
          Container(
            width: 42,
            height: 42,
            decoration: BoxDecoration(
              color: iconColor.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(14),
            ),
            child: Icon(icon, color: iconColor),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
                const SizedBox(height: 4),
                Text(subtitle, style: const TextStyle(color: Color(0xFF6B7280))),
              ],
            ),
          ),
          Switch(
            value: value,
            onChanged: onChanged,
          ),
        ],
      ),
    );
  }
}

class _SliderCard extends StatelessWidget {
  const _SliderCard({
    required this.title,
    required this.subtitle,
    required this.icon,
    required this.iconColor,
    required this.value,
    required this.min,
    required this.max,
    required this.labels,
    required this.onChanged,
  });

  final String title;
  final String subtitle;
  final IconData icon;
  final Color iconColor;
  final double value;
  final double min;
  final double max;
  final List<String> labels;
  final ValueChanged<double> onChanged;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 42,
                height: 42,
                decoration: BoxDecoration(
                  color: iconColor.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(14),
                ),
                child: Icon(icon, color: iconColor),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(title, style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16, color: scheme.onSurface)),
                    const SizedBox(height: 4),
                    Text(subtitle, style: TextStyle(color: scheme.onSurfaceVariant)),
                  ],
                ),
              ),
            ],
          ),
          Slider(
            value: value,
            min: min,
            max: max,
            onChanged: onChanged,
          ),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: labels.map((label) => Text(label, style: TextStyle(color: scheme.onSurfaceVariant, fontSize: 12))).toList(),
          ),
        ],
      ),
    );
  }
}

class _SettingsLinkCard extends StatelessWidget {
  const _SettingsLinkCard({
    required this.title,
    required this.subtitle,
    required this.icon,
    required this.iconColor,
  });

  final String title;
  final String subtitle;
  final IconData icon;
  final Color iconColor;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return AppCard(
      child: Row(
        children: [
          Container(
            width: 42,
            height: 42,
            decoration: BoxDecoration(
              color: iconColor.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(14),
            ),
            child: Icon(icon, color: iconColor),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16, color: scheme.onSurface)),
                const SizedBox(height: 4),
                Text(subtitle, style: TextStyle(color: scheme.onSurfaceVariant)),
              ],
            ),
          ),
          Icon(Icons.arrow_forward_ios_rounded, size: 16, color: scheme.onSurfaceVariant),
        ],
      ),
    );
  }
}

class EditProfileScreen extends StatefulWidget {
  const EditProfileScreen({super.key, required this.profile});

  final RiderProfile profile;

  @override
  State<EditProfileScreen> createState() => _EditProfileScreenState();
}

class _EditProfileScreenState extends State<EditProfileScreen> {
  late TextEditingController _name;
  late TextEditingController _email;
  late TextEditingController _phone;

  @override
  void initState() {
    super.initState();
    _name = TextEditingController(text: widget.profile.name);
    _email = TextEditingController(text: widget.profile.email);
    _phone = TextEditingController(text: widget.profile.phone);
  }

  @override
  void dispose() {
    _name.dispose();
    _email.dispose();
    _phone.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
          child: Column(
            children: [
              const InnerBlueHeader(title: 'Edit Profile'),
              const SizedBox(height: 20),
              AppCard(
                child: Column(
                  children: [
                    AppTextField(controller: _name, label: 'Full Name', hint: 'Ahmed Khan'),
                    const SizedBox(height: 16),
                    AppTextField(controller: _email, label: 'Email', hint: 'ahmed@example.com'),
                    const SizedBox(height: 16),
                    AppTextField(controller: _phone, label: 'Phone', hint: '+92 300 1234567'),
                  ],
                ),
              ),
              const SizedBox(height: 18),
              AppPrimaryButton(
                text: 'Save Changes',
                onPressed: () {
                  Navigator.of(context).pop(
                    widget.profile.copyWith(
                      name: _name.text,
                      email: _email.text,
                      phone: _phone.text,
                    ),
                  );
                },
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class ChangePasswordScreen extends StatelessWidget {
  const ChangePasswordScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
          child: Column(
            children: [
              const InnerBlueHeader(title: 'Change Password'),
              const SizedBox(height: 20),
              const AppCard(
                child: Column(
                  children: [
                    AppTextField(label: 'Old Password', hint: 'Enter old password', obscure: true),
                    SizedBox(height: 16),
                    AppTextField(label: 'New Password', hint: 'Enter new password', obscure: true),
                    SizedBox(height: 16),
                    AppTextField(label: 'Confirm Password', hint: 'Confirm new password', obscure: true),
                  ],
                ),
              ),
              const SizedBox(height: 18),
              AppPrimaryButton(text: 'Update Password'),
            ],
          ),
        ),
      ),
    );
  }
}

class LanguageScreen extends StatelessWidget {
  const LanguageScreen({super.key, required this.selectedLanguage});

  final String selectedLanguage;

  @override
  Widget build(BuildContext context) {
    final languages = ['English (US)', 'English (UK)', 'Urdu', 'Arabic'];
    return Scaffold(
      body: SafeArea(
        child: Column(
          children: [
            const Padding(
              padding: EdgeInsets.fromLTRB(16, 12, 16, 0),
              child: Row(
                children: [
                  CircleAvatar(
                    radius: 20,
                    backgroundColor: Color(0xFFF1F5F9),
                    child: Icon(Icons.arrow_back, color: Color(0xFF111827), size: 18),
                  ),
                  SizedBox(width: 12),
                  Text('Language', style: TextStyle(fontSize: 24, fontWeight: FontWeight.w700)),
                ],
              ),
            ),
            const SizedBox(height: 20),
            Expanded(
              child: ListView.separated(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                itemCount: languages.length,
                separatorBuilder: (_, __) => const SizedBox(height: 12),
                itemBuilder: (context, index) {
                  final language = languages[index];
                  final selected = language == selectedLanguage;
                  return InkWell(
                    onTap: () => Navigator.of(context).pop(language),
                    borderRadius: BorderRadius.circular(20),
                    child: AppCard(
                      child: Row(
                        children: [
                          Container(
                            width: 44,
                            height: 44,
                            decoration: BoxDecoration(
                              color: (selected ? _brandBlue : const Color(0xFFEAF2FF)).withValues(alpha: 0.15),
                              borderRadius: BorderRadius.circular(14),
                            ),
                            child: Icon(Icons.language, color: selected ? _brandBlue : const Color(0xFF60A5FA)),
                          ),
                          const SizedBox(width: 14),
                          Expanded(
                            child: Text(language, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
                          ),
                          if (selected) const Icon(Icons.check_circle, color: _brandBlue),
                        ],
                      ),
                    ),
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class SosAlertScreen extends StatelessWidget {
  const SosAlertScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: _brandRed,
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 18, 16, 24),
          child: Column(
            children: [
              const Icon(Icons.warning_amber_rounded, color: Colors.white, size: 92),
              const SizedBox(height: 10),
              const Text(
                'Accident Detected!',
                style: TextStyle(color: Colors.white, fontSize: 38, fontWeight: FontWeight.w700),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 8),
              const Text(
                'Emergency alert will be sent automatically',
                style: TextStyle(color: Colors.white, fontSize: 18),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 28),
              Container(
                width: 196,
                height: 196,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  border: Border.all(color: Colors.white.withValues(alpha: 0.18), width: 10),
                ),
                child: Center(
                  child: Container(
                    width: 154,
                    height: 154,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: Colors.white.withValues(alpha: 0.18),
                    ),
                    child: const Center(
                      child: Text('8', style: TextStyle(color: Colors.white, fontSize: 58, fontWeight: FontWeight.w300)),
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 18),
              const Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.access_time_rounded, color: Colors.white, size: 16),
                  SizedBox(width: 8),
                  Text('Sending alert in 8 seconds', style: TextStyle(color: Colors.white, fontSize: 16)),
                ],
              ),
              const SizedBox(height: 28),
              AppPrimaryButton(
                text: 'Send Emergency Alert Now',
                color: Colors.white,
                textColor: _brandRed,
                icon: Icons.send_outlined,
                onPressed: () {},
              ),
              const SizedBox(height: 14),
              OutlinedButton(
                onPressed: () => Navigator.of(context).pop(),
                style: OutlinedButton.styleFrom(
                  minimumSize: const Size(double.infinity, 58),
                  side: const BorderSide(color: Colors.white, width: 1.5),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
                ),
                child: const Text(
                  "Cancel Alert (I'm OK)",
                  style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.w700),
                ),
              ),
              const SizedBox(height: 18),
              const _SosInfoCard(icon: Icons.location_on_outlined, title: 'Your Location', subtitle: 'Lat: 28.6139, Long: 77.2090'),
              const SizedBox(height: 12),
              const _SosInfoCard(icon: Icons.people_outline, title: 'Emergency Contacts', subtitle: ''),
              const SizedBox(height: 12),
              const _SosInfoCard(icon: Icons.local_hospital_outlined, title: 'Emergency Services', subtitle: 'Nearby hospitals will be notified'),
            ],
          ),
        ),
      ),
    );
  }
}

class _SosInfoCard extends StatelessWidget {
  const _SosInfoCard({
    required this.icon,
    required this.title,
    required this.subtitle,
  });

  final IconData icon;
  final String title;
  final String subtitle;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(18),
      ),
      child: Row(
        children: [
          Icon(icon, color: Colors.white),
          const SizedBox(width: 14),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(title, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700)),
              const SizedBox(height: 4),
              Text(subtitle, style: const TextStyle(color: Color(0xFFFFD8D8))),
            ],
          ),
        ],
      ),
    );
  }
}

class AppCard extends StatelessWidget {
  const AppCard({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(18),
    this.borderRadius = 22,
  });

  final Widget child;
  final EdgeInsets padding;
  final double borderRadius;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Container(
      width: double.infinity,
      padding: padding,
      decoration: BoxDecoration(
        color: scheme.surface,
        borderRadius: BorderRadius.circular(borderRadius),
        boxShadow: const [_cardShadow],
        border: Border.all(color: scheme.outlineVariant.withValues(alpha: 0.45)),
      ),
      child: child,
    );
  }
}

class AppTextField extends StatelessWidget {
  const AppTextField({
    super.key,
    required this.label,
    required this.hint,
    this.prefixIcon,
    this.suffixIcon,
    this.obscure = false,
    this.controller,
  });

  final String label;
  final String hint;
  final IconData? prefixIcon;
  final IconData? suffixIcon;
  final bool obscure;
  final TextEditingController? controller;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: TextStyle(fontWeight: FontWeight.w700, color: scheme.onSurface)),
        const SizedBox(height: 8),
        Container(
          height: 58,
          decoration: BoxDecoration(
            color: scheme.surfaceContainerHighest,
            borderRadius: BorderRadius.circular(18),
          ),
          child: TextField(
            controller: controller,
            obscureText: obscure,
            decoration: InputDecoration(
              border: InputBorder.none,
              hintText: hint,
              hintStyle: TextStyle(color: scheme.onSurfaceVariant),
              prefixIcon: prefixIcon != null ? Icon(prefixIcon, color: scheme.onSurfaceVariant) : null,
              suffixIcon: suffixIcon != null ? Icon(suffixIcon, color: scheme.onSurfaceVariant) : null,
              contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 18),
            ),
          ),
        ),
      ],
    );
  }
}

class AppPrimaryButton extends StatelessWidget {
  const AppPrimaryButton({
    super.key,
    required this.text,
    this.onPressed,
    this.color = _brandBlue,
    this.textColor = Colors.white,
    this.icon,
  });

  final String text;
  final VoidCallback? onPressed;
  final Color color;
  final Color textColor;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: double.infinity,
      height: 58,
      child: FilledButton(
        onPressed: onPressed,
        style: FilledButton.styleFrom(
          backgroundColor: color,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
          elevation: 0,
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            if (icon != null) ...[
              Icon(icon, color: textColor),
              const SizedBox(width: 10),
            ],
            Text(
              text,
              style: TextStyle(color: textColor, fontSize: 20, fontWeight: FontWeight.w700),
            ),
          ],
        ),
      ),
    );
  }
}

class AppSecondaryButton extends StatelessWidget {
  const AppSecondaryButton({super.key, required this.text, this.onPressed});

  final String text;
  final VoidCallback? onPressed;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return SizedBox(
      height: 58,
      child: OutlinedButton(
        onPressed: onPressed,
        style: OutlinedButton.styleFrom(
          side: BorderSide(color: scheme.outlineVariant),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
        ),
        child: Text(text, style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: scheme.onSurface)),
      ),
    );
  }
}

class AuthHeader extends StatelessWidget {
  const AuthHeader({
    super.key,
    required this.icon,
    required this.title,
    this.subtitle,
  });

  final IconData icon;
  final String title;
  final String? subtitle;

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 228,
      width: double.infinity,
      decoration: const BoxDecoration(
        color: _brandBlue,
        borderRadius: BorderRadius.only(
          bottomLeft: Radius.circular(34),
          bottomRight: Radius.circular(34),
        ),
      ),
      child: Stack(
        children: [
          Positioned(
            top: -28,
            left: -10,
            child: Container(
              width: 150,
              height: 150,
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.05),
                shape: BoxShape.circle,
              ),
            ),
          ),
          Positioned(
            top: -26,
            right: -18,
            child: Container(
              width: 180,
              height: 180,
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.05),
                shape: BoxShape.circle,
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(22, 20, 22, 24),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.end,
              children: [
                Container(
                  width: 94,
                  height: 94,
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(26),
                  ),
                  child: Padding(
                    padding: const EdgeInsets.all(12),
                    child: Image.asset('assets/images/logo.png', fit: BoxFit.cover),
                  ),
                ),
                const SizedBox(height: 22),
                Text(title, style: const TextStyle(color: Colors.white, fontSize: 36, fontWeight: FontWeight.w700)),
                if (subtitle != null) ...[
                  const SizedBox(height: 8),
                  Text(subtitle!, style: const TextStyle(color: Color(0xFFD9DBFF), fontSize: 16)),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class InnerBlueHeader extends StatelessWidget {
  const InnerBlueHeader({
    super.key,
    required this.title,
    this.showBack = true,
    this.child,
  });

  final String title;
  final bool showBack;
  final Widget? child;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      decoration: const BoxDecoration(
        color: _brandBlue,
        borderRadius: BorderRadius.only(
          bottomLeft: Radius.circular(28),
          bottomRight: Radius.circular(28),
        ),
      ),
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 20),
      child: Column(
        children: [
          Row(
            children: [
              if (showBack)
                GestureDetector(
                  onTap: () => Navigator.of(context).maybePop(),
                  child: const CircleAvatar(
                    radius: 18,
                    backgroundColor: Color(0x1FFFFFFF),
                    child: Icon(Icons.arrow_back, color: Colors.white, size: 18),
                  ),
                ),
              if (showBack) const SizedBox(width: 12),
              Text(title, style: const TextStyle(color: Colors.white, fontSize: 24, fontWeight: FontWeight.w700)),
            ],
          ),
          if (child != null) ...[
            const SizedBox(height: 14),
            child!,
          ],
        ],
      ),
    );
  }
}

class _BottomItem extends StatelessWidget {
  const _BottomItem({
    required this.icon,
    required this.activeIcon,
    required this.label,
    required this.active,
    required this.onTap,
  });

  final IconData icon;
  final IconData activeIcon;
  final String label;
  final bool active;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: InkWell(
        onTap: onTap,
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(active ? activeIcon : icon, color: active ? _brandBlue : const Color(0xFF9CA3AF), size: 30),
            const SizedBox(height: 6),
            Text(
              label,
              style: TextStyle(
                color: active ? _brandBlue : const Color(0xFF9CA3AF),
                fontWeight: active ? FontWeight.w700 : FontWeight.w500,
                fontSize: 16,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _StatusChip extends StatelessWidget {
  const _StatusChip({
    required this.text,
    required this.color,
    required this.textColor,
  });

  final String text;
  final Color color;
  final Color textColor;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        color: color,
        borderRadius: BorderRadius.circular(20),
      ),
      child: Text(text, style: TextStyle(color: textColor, fontWeight: FontWeight.w700)),
    );
  }
}

class _MapPlaceholder extends StatelessWidget {
  const _MapPlaceholder({required this.height});

  final double height;

  @override
  Widget build(BuildContext context) {
    return Container(
      height: height,
      width: double.infinity,
      decoration: BoxDecoration(
        color: const Color(0xFFF1F4FA),
        borderRadius: BorderRadius.circular(18),
      ),
      child: const Center(
        child: Icon(Icons.location_on_outlined, color: _brandBlue, size: 42),
      ),
    );
  }
}

class MapGridPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = const Color(0xFFD7E8E8)
      ..strokeWidth = 1;

    for (double x = 0; x < size.width; x += 90) {
      canvas.drawLine(Offset(x, 0), Offset(x, size.height), paint);
    }
    for (double y = 0; y < size.height; y += 90) {
      canvas.drawLine(Offset(0, y), Offset(size.width, y), paint);
    }
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

