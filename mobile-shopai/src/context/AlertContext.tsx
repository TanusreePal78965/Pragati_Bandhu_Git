import React, { createContext, useContext, useState, useCallback, ReactNode } from "react";
import {
    CustomAlertModal,
    CustomAlertOptions,
    AlertButton,
    AlertType,
} from "../components/common/CustomAlertModal";

interface AlertContextType {
    showAlert: (
        titleOrOptions: string | CustomAlertOptions,
        message?: string,
        buttons?: AlertButton[],
        type?: AlertType
    ) => void;
    hideAlert: () => void;
}

const AlertContext = createContext<AlertContextType | undefined>(undefined);

export function AlertProvider({ children }: { children: ReactNode }) {
    const [alertConfig, setAlertConfig] = useState<CustomAlertOptions | null>(null);
    const [visible, setVisible] = useState(false);

    const showAlert = useCallback(
        (
            titleOrOptions: string | CustomAlertOptions,
            message?: string,
            buttons?: AlertButton[],
            type?: AlertType
        ) => {
            if (typeof titleOrOptions === "object") {
                setAlertConfig(titleOrOptions);
            } else {
                setAlertConfig({
                    title: titleOrOptions,
                    message,
                    buttons,
                    type,
                });
            }
            setVisible(true);
        },
        []
    );

    const hideAlert = useCallback(() => {
        setVisible(false);
    }, []);

    return (
        <AlertContext.Provider value={{ showAlert, hideAlert }}>
            {children}
            {alertConfig && (
                <CustomAlertModal
                    visible={visible}
                    title={alertConfig.title}
                    message={alertConfig.message}
                    type={alertConfig.type}
                    icon={alertConfig.icon}
                    buttons={alertConfig.buttons}
                    onDismiss={hideAlert}
                />
            )}
        </AlertContext.Provider>
    );
}

export function useAlert() {
    const context = useContext(AlertContext);
    if (!context) {
        throw new Error("useAlert must be used within an AlertProvider");
    }
    return context;
}
