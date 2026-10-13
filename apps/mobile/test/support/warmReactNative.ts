import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";

// React Native loads each component the first time something reads it. On a cold Jest cache that
// meant transforming about 150 files inside the first test that rendered a screen, which timed out
// on a busy CI runner. Reading them here, before any test starts, keeps that one-off cost out of
// the first test's timer. These are the components the app's screens use.
export const warmedComponents = [
  ActivityIndicator,
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View,
];
