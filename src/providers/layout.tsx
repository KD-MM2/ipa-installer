// Create a separate client component for providers
'use client';

import { PrimeReactProvider } from 'primereact/api';

// Create a separate client component for providers

function LayoutProviders({ children }: { children: React.ReactNode }) {
    return <PrimeReactProvider>{children}</PrimeReactProvider>;
}

export default LayoutProviders;
