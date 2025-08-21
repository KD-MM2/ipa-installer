// Create a separate client component for providers
'use client';

import { PrimeReactProvider } from 'primereact/api';

function LayoutProviders({ children }: { children: React.ReactNode }) {
    return (
        <PrimeReactProvider>
            {children}
        </PrimeReactProvider>
    );
}

export default LayoutProviders;
