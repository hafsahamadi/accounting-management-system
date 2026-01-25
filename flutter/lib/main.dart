import 'package:flutter/material.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'screens/login.dart';
import 'screens/home.dart';
import 'screens/upload.dart';    
import 'screens/documents.dart'; 
import 'screens/profile.dart';   


void main() async {

  WidgetsFlutterBinding.ensureInitialized();

  try {
 
    await initializeDateFormatting('fr_FR', null);
  } catch (e) {
    print("DEBUG DANS MAIN: ERREUR pendant initializeDateFormatting: $e");
  }

  runApp(const MyApp()); 
  print("DEBUG DANS MAIN: runApp() a été appelé.");
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});
  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Cleverbills',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        primarySwatch: Colors.indigo,
        scaffoldBackgroundColor: Colors.white,
        appBarTheme: const AppBarTheme(
          backgroundColor: Colors.white,
          foregroundColor: Colors.black,
          elevation: 0,
          titleTextStyle: TextStyle(color: Colors.black, fontSize: 20, fontWeight: FontWeight.bold)
        )
      ),
      initialRoute: '/',
      routes: {
        '/': (context) => LoginScreen(),
        '/login': (context) => LoginScreen(),
        '/home': (context) => DashboardScreen(),
        '/upload': (context) => UploadApp(),
        '/documents': (context) => UploadHistoryPage(),
        '/profile': (context) => ProfilePage(),
      },
    );
  }
  
}