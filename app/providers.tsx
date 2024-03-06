"use client";

import * as React from "react";
import { NextUIProvider } from "@nextui-org/system";
import { useRouter } from 'next/navigation'
import { ThemeProvider as NextThemesProvider } from "next-themes";
import { ThemeProviderProps } from "next-themes/dist/types";

export interface ProvidersProps {
	children: React.ReactNode;
	themeProps?: ThemeProviderProps;
}

type ContextType = {
	movingCard?: boolean;
	toggleMovingCard?: () => void;
};

export const MovingCardContext = React.createContext<ContextType>({});

export function Providers({ children, themeProps }: ProvidersProps) {
  	const router = useRouter();
	const [movingCard, setMovingCard] = React.useState(false);

	const toggleMovingCard = () => {
		setMovingCard(!movingCard);
	};

	return (
		<NextUIProvider navigate={router.push}>
			<NextThemesProvider {...themeProps}>
				<MovingCardContext.Provider value={{ movingCard, toggleMovingCard }}>
					{children}
				</MovingCardContext.Provider>
			</NextThemesProvider>
		</NextUIProvider>
	);
}
