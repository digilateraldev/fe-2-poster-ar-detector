import React, { useState } from 'react';
import BMIPointerIntegrated from './BMI2807';
import SelectionResults from './SelectionResults';
import { apiUtils } from '../utils/deviceId';
import { deviceIdManager } from '../utils/deviceId';

const BMISelectionApp = () => {
  const [currentView, setCurrentView] = useState('selection'); // 'selection' or 'results'
  const [selectionData, setSelectionData] = useState(null);

  const handleSelectionComplete = async (data) => {
    console.log('Selection completed:', data);
    // setSelectionData(data);
    // setCurrentView('results');
    try {
      // Move the API call here from BMIPointerIntegrated
      const response = await apiUtils.post('/store', {
        qrId: data.qrId,
        deviceId: deviceIdManager.getDeviceId(),
        selection: data.selection,
        timestamp: new Date().toISOString()
      });

      if (response.ok) {
        setSelectionData(data);
        setCurrentView('results');
      } else {
        alert("Failed to store selection");
      }
    } catch (error) {
      console.error("Submit failed", error);
      alert("Error submitting selection");
    }
  };

  const handleBackToSelection = () => {
    setCurrentView('selection');
    setSelectionData(null);
  };

  return (
    <div style={{ width: '100vw', height: '100vh', overflow: 'hidden' }}>
      {currentView === 'selection' && (
        <BMIPointerIntegrated 
          onSelectionComplete={handleSelectionComplete}
        />  
      )}
      
      {currentView === 'results' && selectionData && (
        <SelectionResults 
          selection={selectionData.selection}
          onBackToSelection={handleBackToSelection}
        />
      )}
    </div>
  );
};

export default BMISelectionApp;
