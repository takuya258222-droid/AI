import type { NextConfig } from 'next';
const config: NextConfig = { serverExternalPackages:['pdfkit'], outputFileTracingIncludes:{'/api/admin/pdf':['./node_modules/@fontsource/noto-sans-jp/files/noto-sans-jp-japanese-400-normal.woff']}, async headers() { return [{source:'/:path*',headers:[{key:'X-Content-Type-Options',value:'nosniff'},{key:'Referrer-Policy',value:'no-referrer'},{key:'X-Frame-Options',value:'DENY'},{key:'Permissions-Policy',value:'camera=(), microphone=(), geolocation=()'}]},{source:'/api/:path*',headers:[{key:'Cache-Control',value:'no-store'}]}]; } };
export default config;
