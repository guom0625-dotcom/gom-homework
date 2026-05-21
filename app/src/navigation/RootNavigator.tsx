import React, { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuthStore } from '../store/authStore';
import { useAppStore } from '../store/appStore';
import { useServerUrl } from '../hooks/useServerUrl';
import { useUpdateCheck } from '../hooks/useUpdateCheck';
import { WelcomeScreen } from '../screens/auth/WelcomeScreen';
import { PairingScreen } from '../screens/auth/PairingScreen';
import { MainHorizontal } from '../screens/student/MainHorizontal';
import { TaskListScreen } from '../screens/student/TaskList';
import { TaskRegisterScreen } from '../screens/student/TaskRegister';
import { DashboardScreen } from '../screens/manager/Dashboard';
import { ApprovalScreen } from '../screens/manager/Approval';
import { CatalogScreen } from '../screens/manager/CatalogScreen';
import { SpendApprovalScreen } from '../screens/manager/SpendApprovalScreen';
import { SpendScreen } from '../screens/student/SpendScreen';
import { ProfileScreen } from '../screens/student/ProfileScreen';
import { colors } from '../theme';

export type AuthStackParams = {
    Welcome: undefined;
    Pairing: undefined;
    StudentMain: undefined;
};

export type StudentStackParams = {
    Main: undefined;
    TaskList: { day: number };
    TaskRegister: { day: number };
    Spend: undefined;
    Profile: undefined;
};

export type ManagerStackParams = {
    Dashboard: undefined;
    Approval: { studentId: string; studentName: string };
    Catalog: undefined;
    SpendApproval: undefined;
};

const AuthStack = createNativeStackNavigator<AuthStackParams>();
const PairingOnlyStack = createNativeStackNavigator();
const StudentStack = createNativeStackNavigator<StudentStackParams>();
const ManagerStack = createNativeStackNavigator<ManagerStackParams>();

function StudentNavigator() {
    return (
        <StudentStack.Navigator screenOptions={{ headerShown: false }}>
            <StudentStack.Screen name="Main" component={MainHorizontal} />
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
            <ManagerStack.Screen name="Catalog" component={CatalogScreen} />
            <ManagerStack.Screen name="SpendApproval" component={SpendApprovalScreen} />
        </ManagerStack.Navigator>
    );
}

export function RootNavigator() {
    useServerUrl();
    useUpdateCheck();
    const { user, isLoading, init, needsPairing } = useAuthStore();
    const { fetchMe, reset } = useAppStore();

    useEffect(() => { init(); }, []);

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
