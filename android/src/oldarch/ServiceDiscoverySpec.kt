package com.servicediscovery

import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.Promise

abstract class ServiceDiscoverySpec internal constructor(context: ReactApplicationContext) :
  ReactContextBaseJavaModule(context) {
    
  abstract fun startSearch(type: String, promise: Promise)
  abstract fun stopSearch(type: String, promise: Promise)
  abstract fun addListener(eventName: String)
  abstract fun removeListeners(count: Double)

}
