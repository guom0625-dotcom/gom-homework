import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuthStore } from '../store/authStore';
import { useAppStore } from '../store/appStore';
import { useServerUrl } from '../hooks/useServerUrl';
import { usePushRegistration } from '../hooks/usePushRegistration';
import { WelcomeScreen } from '../screens/auth/WelcomeScreen';
import { PairingScreen } from '../screens/auth/PairingScreen';
import { MainScreen } from '../screens/student/MainScreen';
import { TaskListScreen } from '../screens/student/TaskList';
import { TaskRegisterScreen } from '../screens/student/TaskRegister';
import { DashboardScreen } from '../screens/manager/Dashboard';
import { ApprovalScreen } from '../screens/manager/Approval';
import { ManagerMenuScreen } from '../screens/manager/ManagerMenu';
import { CatalogScreen } from '../screens/manager/CatalogScreen';
import { RewardUseScreen } from '../screens/manager/RewardUseScreen';
import { SpendScreen } from '../screens/student/SpendScreen';
import { ProfileScreen } from '../screens/student/ProfileScreen';
import { colors, fontFamilies, fontSizes, radius } from '../theme';

export type AuthStackParams = {
    Welcome: undefined;
    Pairing: undefined;
    StudentMain: undefined;
};

export type StudentStackParams = {
    Main: undefined;
    TaskList: { day: number };
    // task 가 있으면 반려된 계획을 고쳐서 다시 상신하는 수정 모드
    TaskRegister: { day: number; task?: { id: string; title: string; memo: string | null } };
    Spend: undefined;
    Profile: undefined;
};

export type ManagerStackParams = {
    Dashboard: undefined;
    Approval: { studentId: string; studentName: string };
    ManagerMenu: undefined;
    Catalog: undefined;
    RewardUse: undefined;
};

const AuthStack = createNativeStackNavigator<AuthStackParams>();
const PairingOnlyStack = createNativeStackNavigator();
const StudentStack = createNativeStackNavigator<StudentStackParams>();
const ManagerStack = createNativeStackNavigator<ManagerStackParams>();

function StudentNavigator() {
    return (
        <StudentStack.Navigator screenOptions={{ headerShown: false }}>
            <StudentStack.Screen name="Main" component={MainScreen} />
            <StudentStack.Screen name="TaskList" component={TaskListScreen} />
            <StudentStack.Screen name="TaskRegister" component={TaskRegisterScreen} />
            <StudentStack.Screen name="Spend" component={SpendScreen} />
            <StudentStack.Screen name="Profile" component={ProfileScreen} />
        </StudentStack.Navigator>
    );
}

function ManagerNavigator() {
    return (
        <ManagerStack.Navigator screenOptions={{ headerShown: false }}>
            <ManagerStack.Screen name="Dashboard" component={DashboardScreen} />
            <ManagerStack.Screen name="Approval" component={ApprovalScreen} />
            <ManagerStack.Screen name="ManagerMenu" component={ManagerMenuScreen} />
            <ManagerStack.Screen name="Catalog" component={CatalogScreen} />
            <ManagerStack.Screen name="RewardUse" component={RewardUseScreen} />
        </ManagerStack.Navigator>
    );
}

export function RootNavigator() {
    useServerUrl();
    const { user, isLoading, init, needsPairing, connectionError } = useAuthStore();
    const { fetchMe, reset } = useAppStore();
    usePushRegistration(user?.id);

    useEffect(() => { init(); }, []);

    // 서버에 닿지 못한 상태면 5초마다 다시 시도 (WiFi가 늦게 붙는 경우 등)
    useEffect(() => {
        if (!connectionError) return;
        const timer = setInterval(() => { init(); }, 5000);
        return () => clearInterval(timer);
    }, [connectionError]);

    useEffect(() => {
        if (user) {
            fetchMe().catch(() => {});
        } else {
            reset();
        }
    }, [user?.id]);

    if (isLoading) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.paper }}>
                <ActivityIndicator size="large" color={colors.ocean[500]} />
            </View>
        );
    }

    if (connectionError && !user) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: 14, padding: 24, backgroundColor: colors.paper }}>
                <Text style={{ fontSize: 40 }}>📡</Text>
                <Text style={{ fontFamily: fontFamilies.display, fontSize: fontSizes['2xl'], color: colors.ink[900] }}>
                    서버에 연결할 수 없어요
                </Text>
                <Text style={{ fontFamily: fontFamilies.body, fontSize: fontSizes.sm, color: colors.ink[500], textAlign: 'center' }}>
                    인터넷 연결을 확인해주세요.{'\n'}연결되면 자동으로 다시 시도해요.
                </Text>
                <TouchableOpacity
                    onPress={() => { init(); }}
                    style={{ backgroundColor: colors.ocean[500], borderRadius: radius.pill, paddingHorizontal: 24, paddingVertical: 10 }}
                >
                    <Text style={{ fontFamily: fontFamilies.bodyBold, fontSize: fontSizes.base, color: '#fff' }}>다시 시도</Text>
                </TouchableOpacity>
            </View>
        );
    }

    return (
        <NavigationContainer>
            {!user ? (
                needsPairing ? (
                    <PairingOnlyStack.Navigator screenOptions={{ headerShown: false }}>
                        <PairingOnlyStack.Screen name="Pairing" component={PairingScreen} />
                    </PairingOnlyStack.Navigator>
                ) : (
                    <AuthStack.Navigator screenOptions={{ headerShown: false }}>
                        <AuthStack.Screen name="Welcome" component={WelcomeScreen} />
                        <AuthStack.Screen name="Pairing" component={PairingScreen} />
                        <AuthStack.Screen name="StudentMain" component={StudentNavigator as React.ComponentType} />
                    </AuthStack.Navigator>
                )
            ) : user.role === 'student' ? (
                <StudentNavigator />
            ) : (
                <ManagerNavigator />
            )}
        </NavigationContainer>
    );
}
