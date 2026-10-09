const fs = require('fs');
const path = require('path');

const tabsLayout = `import { Tabs } from 'expo-router';
import { Home, Inbox, MessageCircle, Users, Settings } from 'lucide-react-native';
import { View } from 'react-native';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: { backgroundColor: '#14171C', borderTopColor: '#1B1F26' },
        tabBarActiveTintColor: '#0F6E3F',
        tabBarInactiveTintColor: '#6B7075',
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Pulse',
          tabBarIcon: ({ color }) => <Home size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="inbox"
        options={{
          title: 'Inbox',
          tabBarIcon: ({ color }) => <Inbox size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="chats"
        options={{
          title: 'Chat',
          tabBarIcon: ({ color }) => <MessageCircle size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="crm"
        options={{
          title: 'CRM',
          tabBarIcon: ({ color }) => <Users size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Brain',
          tabBarIcon: ({ color }) => <Settings size={24} color={color} />,
        }}
      />
    </Tabs>
  );
}
`;

const stubScreen = (title) => `import { View, Text } from 'react-native';

export default function Screen() {
  return (
    <View className="flex-1 bg-[#0B0D10] items-center justify-center">
      <Text className="text-[#F5F5F0] text-xl font-bold">${title}</Text>
    </View>
  );
}
`;

fs.writeFileSync('ace-merchant-app/app/(tabs)/_layout.tsx', tabsLayout);
fs.writeFileSync('ace-merchant-app/app/(tabs)/index.tsx', stubScreen('Pulse Dashboard'));
fs.writeFileSync('ace-merchant-app/app/(tabs)/inbox.tsx', stubScreen('Action Inbox'));
fs.writeFileSync('ace-merchant-app/app/(tabs)/chats.tsx', stubScreen('Live Chats'));
fs.writeFileSync('ace-merchant-app/app/(tabs)/crm.tsx', stubScreen('CRM & Catalog'));
fs.writeFileSync('ace-merchant-app/app/(tabs)/settings.tsx', stubScreen('Brain Config'));

console.log('Created tab navigation structure.');
