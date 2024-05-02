package com.servicediscovery

import android.content.Context
import android.net.nsd.NsdManager
import android.net.nsd.NsdServiceInfo
import android.util.Log
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableMap
import com.facebook.react.bridge.WritableNativeArray
import com.facebook.react.bridge.WritableNativeMap
import com.facebook.react.modules.core.DeviceEventManagerModule
import java.nio.charset.StandardCharsets


class ServiceDiscoveryModule internal constructor(context: ReactApplicationContext) :
  ServiceDiscoverySpec(context) {

  private val discoveryListeners: MutableMap<String, NsdManager.DiscoveryListener> = HashMap()
  private val nsdManager: NsdManager =
    reactApplicationContext.getSystemService(Context.NSD_SERVICE) as NsdManager

  // Keep track of resolved services, because onServiceLost doesn't pass a resolved service
  private val resolvedServices: MutableMap<String, NsdServiceInfo> = HashMap()

  override fun getName(): String {
    return NAME
  }

  private fun sendEvent(eventName: String, params: WritableMap?) {
    reactApplicationContext
      .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
      .emit(eventName, params)
  }

  @ReactMethod
  override fun addListener(eventName: String) {
  }

  @ReactMethod
  override fun removeListeners(count: Double) {
  }

  @ReactMethod
  override fun startSearch(type: String, promise: Promise) {
    try {
      val serviceType = getServiceType(type)
      if (discoveryListeners.containsKey(serviceType)) {
        // Already searching for $serviceType
        promise.resolve(null)
        return
      }

      val discoveryListener: NsdManager.DiscoveryListener =
        object : NsdManager.DiscoveryListener {
          override fun onDiscoveryStarted(regType: String) {
            // Service discovery started
          }

          override fun onDiscoveryStopped(regType: String) {
            // Service discovery stopped
          }

          override fun onServiceFound(service: NsdServiceInfo) {
            try {
              // Service discovery success
              if (service.serviceType == serviceType) {
                // Resolve the service with ad-hoc listener
                nsdManager.resolveService(service, object : NsdManager.ResolveListener {
                  override fun onServiceResolved(serviceInfo: NsdServiceInfo) {
                    try {
                      resolvedServices[serviceInfo.serviceName] = serviceInfo
                      sendEvent(SERVICE_FOUND, serviceToMap(serviceInfo))
                    } catch (e: Exception) {
                      Log.e(NAME, "Error resolving service", e)
                    }
                  }

                  override fun onResolveFailed(
                    serviceInfo: NsdServiceInfo,
                    errorCode: Int
                  ) {
                    Log.e(NAME, "Resolve failed: $errorCode")
                  }
                })
              }
            } catch (e: Exception) {
              Log.e(NAME, "Error resolving service", e)
            }
          }

          override fun onServiceLost(serviceInfo: NsdServiceInfo) {
            try {
              // Service lost
              val service = resolvedServices.remove(serviceInfo.serviceName)
              if (service != null) {
                sendEvent(SERVICE_LOST, serviceToMap(service))
              } else {
                // Send unresolved service in case it was lost before it was resolved
                sendEvent(SERVICE_LOST, serviceToMap(serviceInfo))
              }
            } catch (e: Exception) {
              Log.e(NAME, "Error resolving service", e)
            }
          }

          override fun onStartDiscoveryFailed(serviceType: String, errorCode: Int) {
            tryStopServiceDiscovery(this)
          }

          override fun onStopDiscoveryFailed(serviceType: String, errorCode: Int) {
            tryStopServiceDiscovery(this)
          }
        }
      discoveryListeners[serviceType] = discoveryListener
      nsdManager.discoverServices(serviceType, NsdManager.PROTOCOL_DNS_SD, discoveryListener)
      promise.resolve(null)
      return
    } catch (e: Exception) {
      Log.e(NAME, "Error resolving service", e)
      promise.reject(e)
    }
  }

  @ReactMethod
  override fun stopSearch(type: String, promise: Promise) {
    try {
      resolvedServices.clear()
      val serviceType = getServiceType(type)
      val discoveryListener = discoveryListeners.remove(serviceType)
      if (discoveryListener != null) {
        tryStopServiceDiscovery(discoveryListener)
      }
    } catch (e: Exception) {
      Log.e(NAME, "Error resolving service", e)
      promise.reject(e)
    }

  }

  private fun tryStopServiceDiscovery(listener: NsdManager.DiscoveryListener) {
    try {
      nsdManager.stopServiceDiscovery(listener)
    } catch (e: Exception) {
      Log.e(NAME, "Error stopping search", e)
    }
  }

  private fun getServiceType(type: String): String {
    return String.format("_%s._tcp.", type)
  }

  private fun serviceToMap(serviceInfo: NsdServiceInfo): WritableMap {
    val service: WritableMap = WritableNativeMap()
    try {
      service.putString("name", serviceInfo.serviceName)
      val serviceType = serviceInfo.serviceType.removePrefix(".");
      service.putString("type", "$serviceType.")
      service.putString("domain", "local.")
      service.putInt("port", serviceInfo.port)

      val host = serviceInfo.host
      if (host != null) {
        service.putString("hostName", host.canonicalHostName)
        service.putArray("addresses", WritableNativeArray().apply {
          pushString(host.hostAddress)
        })
      } else {
        service.putString("hostName", null)
        service.putArray("addresses", WritableNativeArray())
      }
      val txt: WritableMap = WritableNativeMap()
      for ((key, value) in serviceInfo.attributes ?: emptyMap()) {
        if (value != null) {
          txt.putString(key, String(value, StandardCharsets.UTF_8))
        }
      }
      service.putMap("txt", txt)
    } catch (e: Exception) {
      Log.e(NAME, "Error stopping search", e)
    }
    return service
  }

  companion object {
    private const val SERVICE_FOUND = "serviceFound"
    private const val SERVICE_LOST = "serviceLost"
    const val NAME = "ServiceDiscovery"
  }
}
