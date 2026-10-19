import type {Metadata} from 'next';
import './globals.css';
export const metadata:Metadata={title:'Sherlocked 2K26 | Compufest',description:'Solve cases, follow evidence, climb the live leaderboard.'};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>}
