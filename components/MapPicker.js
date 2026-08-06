"use client";
import dynamic from 'next/dynamic';

const MapPickerInner = dynamic(() => import('./MapPickerInner'), { 
  ssr: false,
  loading: () => <div className="flex items-center justify-center p-8 bg-gray-100 rounded-md" style={{minHeight: '300px'}}>Cargando mapa...</div>
});

export default function MapPicker(props) {
  return <MapPickerInner {...props} />;
}
