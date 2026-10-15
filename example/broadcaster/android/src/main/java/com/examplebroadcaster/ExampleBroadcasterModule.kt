package com.examplebroadcaster

import android.content.Context
import android.net.nsd.NsdManager
import android.net.nsd.NsdServiceInfo
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableMap
import java.util.concurrent.ConcurrentHashMap

class ExampleBroadcasterModule(context: ReactApplicationContext) :
  ReactContextBaseJavaModule(context) {

  private val nsdManager =
    context.getSystemService(Context.NSD_SERVICE) as NsdManager
  private val listeners = ConcurrentHashMap<String, NsdManager.RegistrationListener>()

  override fun getName() = "ExampleBroadcaster"

  @ReactMethod
  fun register(name: String, type: String, port: Int, txt: ReadableMap, promise: Promise) {
    if (listeners.containsKey(name)) {
      promise.reject("E_ALREADY_REGISTERED", "'$name' is already registered")
      return
    }

    val info = NsdServiceInfo().apply {
      serviceName = name
      serviceType = "_$type._tcp."
      this.port = port
      val iterator = txt.keySetIterator()
      while (iterator.hasNextKey()) {
        val key = iterator.nextKey()
        setAttribute(key, txt.getString(key))
      }
    }

    val listener = object : NsdManager.RegistrationListener {
      override fun onServiceRegistered(registered: NsdServiceInfo) {
        promise.resolve(null)
      }

      override fun onRegistrationFailed(failed: NsdServiceInfo, errorCode: Int) {
        listeners.remove(name)
        promise.reject("E_REGISTER_FAILED", "Could not publish '$name' (error code $errorCode)")
      }

      override fun onServiceUnregistered(unregistered: NsdServiceInfo) {}

      override fun onUnregistrationFailed(failed: NsdServiceInfo, errorCode: Int) {}
    }

    listeners[name] = listener
    try {
      nsdManager.registerService(info, NsdManager.PROTOCOL_DNS_SD, listener)
    } catch (e: Exception) {
      listeners.remove(name)
      promise.reject("E_REGISTER_FAILED", e)
    }
  }

  @ReactMethod
  fun unregister(name: String, promise: Promise) {
    listeners.remove(name)?.let { unregisterQuietly(it) }
    promise.resolve(null)
  }

  @ReactMethod
  fun unregisterAll(promise: Promise) {
    listeners.keys.toList().forEach { name ->
      listeners.remove(name)?.let { unregisterQuietly(it) }
    }
    promise.resolve(null)
  }

  override fun invalidate() {
    super.invalidate()
    listeners.values.forEach { unregisterQuietly(it) }
    listeners.clear()
  }

  private fun unregisterQuietly(listener: NsdManager.RegistrationListener) {
    try {
      nsdManager.unregisterService(listener)
    } catch (e: Exception) {
      // Not registered (any more)
    }
  }
}
