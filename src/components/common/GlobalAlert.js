import React, { useState, useEffect } from 'react';
import ThemedAlert from './ThemedAlert';
import AlertHelper from '../../utils/AlertHelper';

const GlobalAlert = () => {
  const [alertConfig, setAlertConfig] = useState({
    visible: false,
    title: '',
    message: '',
    buttons: [],
    options: {}
  });

  useEffect(() => {
    AlertHelper.setGlobalAlert(setAlertConfig);
  }, []);

  const handleRequestClose = () => {
    // Check if it's cancelable (default is usually true unless specified)
    const isCancelable = alertConfig.options?.cancelable !== false;
    
    if (isCancelable) {
      if (typeof alertConfig.options?.onDismiss === 'function') {
        alertConfig.options.onDismiss();
      }
      setAlertConfig({ ...alertConfig, visible: false });
    }
  };

  return (
    <ThemedAlert
      visible={alertConfig.visible}
      title={alertConfig.title}
      message={alertConfig.message}
      buttons={alertConfig.buttons}
      onRequestClose={handleRequestClose}
    />
  );
};

export default GlobalAlert;
