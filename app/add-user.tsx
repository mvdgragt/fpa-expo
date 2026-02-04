import { router, useGlobalSearchParams } from "expo-router";
import { useState } from "react";
import {
  Alert,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

export default function AddUserScreen() {
  const [name, setName] = useState("");
  const params = useGlobalSearchParams();
  const { stationId, stationName, stationShortName } = params;

  const getRandomAvatar = () => {
    const gender = Math.random() > 0.5 ? "men" : "women";
    const id = Math.floor(Math.random() * 99) + 1;
    return `https://randomuser.me/api/portraits/${gender}/${id}.jpg`;
  };

  const handleAddUser = () => {
    if (!name.trim()) {
      Alert.alert("Error", "Please enter a name");
      return;
    }

    const newUser = {
      id: Date.now().toString(),
      name: name.trim(),
      image: getRandomAvatar(),
    };

    // Navigate back to select-user with the new user
    router.push({
      pathname: "/select-user",
      params: {
        newUser: JSON.stringify(newUser),
        stationId,
        stationName,
        stationShortName,
      },
    });
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Add New User</Text>
      <Text style={styles.subtitle}>Enter the user name</Text>

      <View style={styles.formContainer}>
        <TextInput
          style={styles.input}
          placeholder="Enter name"
          value={name}
          onChangeText={setName}
          autoFocus
          returnKeyType="done"
          onSubmitEditing={handleAddUser}
        />

        <TouchableOpacity
          style={styles.addButton}
          onPress={handleAddUser}
          activeOpacity={0.8}
        >
          <Text style={styles.addButtonText}>Add User</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.cancelButton}
          onPress={() => router.back()}
          activeOpacity={0.8}
        >
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8f9fa",
    paddingTop: 60,
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#1a1a1a",
    marginBottom: 8,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 16,
    color: "#666",
    marginBottom: 40,
    textAlign: "center",
  },
  formContainer: {
    width: "100%",
  },
  input: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    borderWidth: 2,
    borderColor: "#e0e0e0",
    marginBottom: 20,
  },
  addButton: {
    backgroundColor: "#007AFF",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    marginBottom: 12,
  },
  addButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  cancelButton: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#e0e0e0",
  },
  cancelButtonText: {
    color: "#666",
    fontSize: 16,
    fontWeight: "600",
  },
});
