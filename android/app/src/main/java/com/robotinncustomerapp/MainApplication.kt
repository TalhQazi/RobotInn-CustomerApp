package com.robotinncustomerapp

import android.app.Application
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost

class MainApplication : Application(), ReactApplication {

  override val reactHost: ReactHost by lazy {
    getDefaultReactHost(
      context = applicationContext,
      packageList =
        PackageList(this).packages.apply {
          // Packages that cannot be autolinked yet can be added manually here, for example:
          // add(MyReactNativePackage())
        },
    )
  }

  override fun onCreate() {
    super.onCreate()
    if (BuildConfig.DEBUG) {
      val preferences = applicationContext.getSharedPreferences(
        "${applicationContext.packageName}_preferences",
        android.content.Context.MODE_PRIVATE
      )
      if (!preferences.contains("debug_http_host")) {
        preferences.edit().putString("debug_http_host", "192.168.1.4:8081").apply()
      }
    }
    loadReactNative(this)
  }
}
