import type {Metadata} from 'next';
import '../../app/globals.css';
export const metadata:Metadata={title:'Sherlocked 2K26 | Compufest',description:'Solve the mystery. Official individual competition portal.'};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>}
