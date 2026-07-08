class AlertHelper {
  static setter = null;
  static originalAlert = null;

  static setOriginalAlert(original) {
    this.originalAlert = original;
  }

  static setGlobalAlert(setter) {
    this.setter = setter;
  }

  static alert = (title, message, buttons, options) => {
    if (this.setter) {
      this.setter({ visible: true, title, message, buttons, options });
    } else if (this.originalAlert) {
      this.originalAlert(title, message, buttons, options);
    } else {
      console.warn("Alert called before AlertHelper was initialized:", title, message);
    }
  }
}

export default AlertHelper;
