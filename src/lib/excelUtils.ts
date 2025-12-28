import * as XLSX from 'xlsx';
import type { PDL, Visitor, CrimeEntry } from '@/types';

// Calculate age from date of birth
export const calculateAge = (dateOfBirth: string): number => {
  if (!dateOfBirth) return 0;
  const today = new Date();
  const birthDate = new Date(dateOfBirth);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
};

// Export PDLs to Excel
export const exportPDLsToExcel = (pdls: PDL[]) => {
  const data = pdls.map(pdl => ({
    'PDL Code': pdl.pdl_code,
    'Last Name': pdl.last_name,
    'First Name': pdl.first_name,
    'Middle Name': pdl.middle_name || '',
    'Suffix': pdl.suffix || '',
    'Date of Birth': pdl.date_of_birth,
    'Age': calculateAge(pdl.date_of_birth),
    'Gender': pdl.gender.toUpperCase(),
    'Date of Commit': pdl.date_of_commit,
    'Status': pdl.status.toUpperCase(),
    'Crimes': pdl.crimes?.map(c => c.offense).join('; ') || '',
    'Case Numbers': pdl.crimes?.map(c => c.case_number).join('; ') || '',
    'Created At': new Date(pdl.created_at).toLocaleDateString(),
  }));

  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'PDL Masterlist');
  
  // Auto-size columns
  const colWidths = Object.keys(data[0] || {}).map(key => ({ wch: Math.max(key.length, 15) }));
  ws['!cols'] = colWidths;

  XLSX.writeFile(wb, `PDL_Masterlist_${new Date().toISOString().split('T')[0]}.xlsx`);
};

// Export Visitors to Excel
export const exportVisitorsToExcel = (visitors: Visitor[]) => {
  const data = visitors.map(visitor => ({
    'Visitor Code': visitor.visitor_code,
    'Last Name': visitor.last_name,
    'First Name': visitor.first_name,
    'Middle Name': visitor.middle_name || '',
    'Suffix': visitor.suffix || '',
    'Date of Birth': visitor.date_of_birth,
    'Age': calculateAge(visitor.date_of_birth),
    'Gender': visitor.gender.toUpperCase(),
    'Contact Number': visitor.contact_number,
    'Address': visitor.address,
    'Valid ID Type': visitor.valid_id_type || '',
    'Valid ID Number': visitor.valid_id_number || '',
    'Status': visitor.status.toUpperCase(),
    'Created At': new Date(visitor.created_at).toLocaleDateString(),
  }));

  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Visitor Masterlist');
  
  const colWidths = Object.keys(data[0] || {}).map(key => ({ wch: Math.max(key.length, 15) }));
  ws['!cols'] = colWidths;

  XLSX.writeFile(wb, `Visitor_Masterlist_${new Date().toISOString().split('T')[0]}.xlsx`);
};

// Parse PDLs from Excel
export const parsePDLsFromExcel = (file: File): Promise<Partial<PDL>[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);
        
        const pdls: Partial<PDL>[] = jsonData.map((row: any) => {
          const crimes: CrimeEntry[] = [];
          const offenses = (row['Crimes'] || row['Offense'] || row['Crime/Offense'] || '').toString().split(';').filter(Boolean);
          const caseNumbers = (row['Case Numbers'] || row['Case Number'] || '').toString().split(';').filter(Boolean);
          
          offenses.forEach((offense: string, idx: number) => {
            crimes.push({
              offense: offense.trim().toUpperCase(),
              case_number: (caseNumbers[idx] || '').trim().toUpperCase(),
            });
          });

          return {
            first_name: (row['First Name'] || row['FirstName'] || '').toString().toUpperCase(),
            middle_name: (row['Middle Name'] || row['MiddleName'] || '').toString().toUpperCase(),
            last_name: (row['Last Name'] || row['LastName'] || '').toString().toUpperCase(),
            suffix: (row['Suffix'] || '').toString().toUpperCase(),
            date_of_birth: formatExcelDate(row['Date of Birth'] || row['DOB'] || row['Birthday']),
            gender: (row['Gender'] || 'male').toString().toLowerCase() as 'male' | 'female',
            date_of_commit: formatExcelDate(row['Date of Commit'] || row['Commitment Date']),
            crimes: crimes,
            status: 'detained' as const,
          };
        }).filter(pdl => pdl.first_name && pdl.last_name);

        resolve(pdls);
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = reject;
    reader.readAsBinaryString(file);
  });
};

// Parse Visitors from Excel
export const parseVisitorsFromExcel = (file: File): Promise<Partial<Visitor>[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);
        
        const visitors: Partial<Visitor>[] = jsonData.map((row: any) => ({
          first_name: (row['First Name'] || row['FirstName'] || '').toString().toUpperCase(),
          middle_name: (row['Middle Name'] || row['MiddleName'] || '').toString().toUpperCase(),
          last_name: (row['Last Name'] || row['LastName'] || '').toString().toUpperCase(),
          suffix: (row['Suffix'] || '').toString().toUpperCase(),
          date_of_birth: formatExcelDate(row['Date of Birth'] || row['DOB'] || row['Birthday']),
          gender: (row['Gender'] || 'male').toString().toLowerCase() as 'male' | 'female',
          contact_number: (row['Contact Number'] || row['Contact'] || row['Phone'] || '').toString(),
          address: (row['Address'] || '').toString().toUpperCase(),
          valid_id_type: (row['Valid ID Type'] || row['ID Type'] || '').toString().toUpperCase(),
          valid_id_number: (row['Valid ID Number'] || row['ID Number'] || '').toString().toUpperCase(),
          status: 'active' as const,
        })).filter(visitor => visitor.first_name && visitor.last_name);

        resolve(visitors);
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = reject;
    reader.readAsBinaryString(file);
  });
};

// Helper to format Excel date values
const formatExcelDate = (value: any): string => {
  if (!value) return '';
  
  // If it's already a string in date format
  if (typeof value === 'string') {
    const date = new Date(value);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0];
    }
    return value;
  }
  
  // If it's an Excel serial date number
  if (typeof value === 'number') {
    const date = new Date((value - 25569) * 86400 * 1000);
    return date.toISOString().split('T')[0];
  }
  
  return '';
};

// Download Excel template for PDL
export const downloadPDLTemplate = () => {
  const template = [
    {
      'First Name': 'JUAN',
      'Middle Name': 'DELA',
      'Last Name': 'CRUZ',
      'Suffix': 'JR',
      'Date of Birth': '1990-01-15',
      'Gender': 'MALE',
      'Date of Commit': '2024-01-01',
      'Crimes': 'ROBBERY; THEFT',
      'Case Numbers': 'CR-2024-001; CR-2024-002',
    }
  ];

  const ws = XLSX.utils.json_to_sheet(template);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'PDL Template');
  
  const colWidths = Object.keys(template[0]).map(key => ({ wch: Math.max(key.length, 20) }));
  ws['!cols'] = colWidths;

  XLSX.writeFile(wb, 'PDL_Import_Template.xlsx');
};

// Download Excel template for Visitor
export const downloadVisitorTemplate = () => {
  const template = [
    {
      'First Name': 'MARIA',
      'Middle Name': 'SANTOS',
      'Last Name': 'REYES',
      'Suffix': '',
      'Date of Birth': '1985-05-20',
      'Gender': 'FEMALE',
      'Contact Number': '09171234567',
      'Address': '123 MAIN ST, MANILA',
      'Valid ID Type': 'PHILSYS ID',
      'Valid ID Number': 'PSN-1234-5678-9012',
    }
  ];

  const ws = XLSX.utils.json_to_sheet(template);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Visitor Template');
  
  const colWidths = Object.keys(template[0]).map(key => ({ wch: Math.max(key.length, 20) }));
  ws['!cols'] = colWidths;

  XLSX.writeFile(wb, 'Visitor_Import_Template.xlsx');
};
