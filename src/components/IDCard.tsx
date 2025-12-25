import { forwardRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Shield } from 'lucide-react';
import { getSettings } from '@/lib/localStorage';
import type { PDL, Visitor } from '@/types';

interface PDLIDCardProps {
  pdl: PDL;
}

interface VisitorIDCardProps {
  visitor: Visitor;
}

export const PDLIDCard = forwardRef<HTMLDivElement, PDLIDCardProps>(({ pdl }, ref) => {
  const settings = getSettings();
  
  return (
    <div 
      ref={ref}
      className="w-[340px] h-[214px] bg-gradient-to-br from-slate-800 via-slate-900 to-slate-800 rounded-xl overflow-hidden relative print:shadow-none"
      style={{ fontFamily: 'DM Sans, sans-serif' }}
    >
      {/* Header */}
      <div className="bg-gradient-to-r from-primary/30 to-primary/10 px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="w-6 h-6 text-primary" />
          <div>
            <p className="text-[10px] text-primary/80 font-medium">WATCHGUARD</p>
            <p className="text-[8px] text-slate-400">{settings.facility_name}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-bold text-primary">PDL IDENTIFICATION</p>
          <p className="text-[8px] text-slate-400">OFFICIAL USE ONLY</p>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 flex gap-4">
        {/* Photo */}
        <div className="w-24 h-28 rounded-lg overflow-hidden bg-slate-700 flex-shrink-0 border border-slate-600">
          {pdl.photo_url ? (
            <img src={pdl.photo_url} alt="PDL" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-2xl font-bold text-slate-500">
              {pdl.first_name.charAt(0)}{pdl.last_name.charAt(0)}
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 space-y-1">
          <p className="text-sm font-bold text-white truncate">
            {pdl.last_name.toUpperCase()}, {pdl.first_name} {pdl.middle_name} {pdl.suffix}
          </p>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[10px]">
            <div>
              <p className="text-slate-500">PDL Code</p>
              <p className="font-mono font-semibold text-primary">{pdl.pdl_code}</p>
            </div>
            <div>
              <p className="text-slate-500">Gender</p>
              <p className="text-white capitalize">{pdl.gender}</p>
            </div>
            <div>
              <p className="text-slate-500">Date of Birth</p>
              <p className="text-white">{new Date(pdl.date_of_birth).toLocaleDateString()}</p>
            </div>
            <div>
              <p className="text-slate-500">Case No.</p>
              <p className="text-white">{pdl.case_number || 'N/A'}</p>
            </div>
            <div className="col-span-2">
              <p className="text-slate-500">Commitment Date</p>
              <p className="text-white">{new Date(pdl.date_of_commit).toLocaleDateString()}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="absolute bottom-0 left-0 right-0 h-5 bg-gradient-to-r from-primary/20 via-primary/10 to-primary/20 flex items-center justify-center">
        <p className="text-[8px] text-slate-400">This card is property of {settings.facility_name}</p>
      </div>
    </div>
  );
});

PDLIDCard.displayName = 'PDLIDCard';

export const VisitorIDCard = forwardRef<HTMLDivElement, VisitorIDCardProps>(({ visitor }, ref) => {
  const settings = getSettings();
  
  return (
    <div 
      ref={ref}
      className="w-[340px] h-[214px] bg-gradient-to-br from-slate-100 via-white to-slate-100 rounded-xl overflow-hidden relative print:shadow-none"
      style={{ fontFamily: 'DM Sans, sans-serif' }}
    >
      {/* Header */}
      <div className="bg-gradient-to-r from-primary to-yellow-500 px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="w-6 h-6 text-primary-foreground" />
          <div>
            <p className="text-[10px] text-primary-foreground font-bold">WATCHGUARD</p>
            <p className="text-[8px] text-primary-foreground/80">{settings.facility_name}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-bold text-primary-foreground">VISITOR PASS</p>
          <p className="text-[8px] text-primary-foreground/80">AUTHORIZED ENTRY</p>
        </div>
      </div>

      {/* Content */}
      <div className="p-3 flex gap-3">
        {/* Photo */}
        <div className="w-20 h-24 rounded-lg overflow-hidden bg-slate-200 flex-shrink-0 border border-slate-300">
          {visitor.photo_url ? (
            <img src={visitor.photo_url} alt="Visitor" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-xl font-bold text-slate-400">
              {visitor.first_name.charAt(0)}{visitor.last_name.charAt(0)}
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 space-y-1">
          <p className="text-sm font-bold text-slate-800 truncate">
            {visitor.last_name.toUpperCase()}, {visitor.first_name} {visitor.middle_name}
          </p>
          <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-[9px]">
            <div>
              <p className="text-slate-500">Visitor ID</p>
              <p className="font-mono font-semibold text-primary">{visitor.visitor_code}</p>
            </div>
            <div>
              <p className="text-slate-500">Gender</p>
              <p className="text-slate-700 capitalize">{visitor.gender}</p>
            </div>
            <div className="col-span-2">
              <p className="text-slate-500">Contact</p>
              <p className="text-slate-700">{visitor.contact_number}</p>
            </div>
          </div>
        </div>

        {/* QR Code */}
        <div className="flex flex-col items-center justify-center">
          <div className="p-1.5 bg-white rounded-lg border border-slate-200">
            <QRCodeSVG 
              value={visitor.visitor_code} 
              size={64}
              level="M"
            />
          </div>
          <p className="text-[7px] text-slate-500 mt-1">SCAN TO VERIFY</p>
        </div>
      </div>

      {/* Footer */}
      <div className="absolute bottom-0 left-0 right-0 h-5 bg-gradient-to-r from-slate-200 via-slate-100 to-slate-200 flex items-center justify-center">
        <p className="text-[7px] text-slate-500">Must be surrendered upon exit • {settings.facility_name}</p>
      </div>
    </div>
  );
});

VisitorIDCard.displayName = 'VisitorIDCard';
