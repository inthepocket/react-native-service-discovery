package com.servicediscovery

import android.content.Context
import android.net.nsd.NsdManager
import android.net.nsd.NsdServiceInfo
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.util.Log
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableMap
import com.facebook.react.bridge.WritableNativeArray
import com.facebook.react.bridge.WritableNativeMap
import com.facebook.react.modules.core.DeviceEventManagerModule
import java.nio.charset.StandardCharsets
import java.util.LinkedList


class ServiceDiscoveryModule internal constructor(context: ReactApplicationContext) :
  ServiceDiscoverySpec(context) {

  private val discoveryListeners: MutableMap<String, NsdManager.DiscoveryListener> = HashMap()
  private val nsdManager: NsdManager =
    reactApplicationContext.getSystemService(Context.NSD_SERVICE) as NsdManager

  // Keep track of resolved services, because onServiceLost doesn't pass a resolved service.
  // Keyed by serviceKey() so identical names of different types don't collide.
  private val resolvedServices: MutableMap<String, NsdServiceInfo> = HashMap()

  // Resolve queue to handle Android's single-resolve limitation
  private data class ResolveRequest(val service: NsdServiceInfo, var retryCount: Int = 0)
  private val resolveQueue: LinkedList<ResolveRequest> = LinkedList()
  private var isResolving: Boolean = false
  private val mainHandler = Handler(Looper.getMainLooper())
  private val pendingServices: MutableSet<String> = HashSet()

  companion object {
    private const val SERVICE_FOUND = "serviceFound"
    private const val SERVICE_LOST = "serviceLost"
    private const val MAX_RETRY_COUNT = 3
    private const val RETRY_DELAY_MS = 100L
    const val NAME = "ServiceDiscovery"
  }

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

  private fun queueServiceForResolve(service: NsdServiceInfo) {
    val serviceKey = serviceKey(service)
    synchronized(resolveQueue) {
      // Skip if already pending or resolved
      if (pendingServices.contains(serviceKey) || resolvedServices.containsKey(serviceKey)) {
        return
      }
      pendingServices.add(serviceKey)
      resolveQueue.add(ResolveRequest(service))
      Log.d(NAME, "Queued service for resolve: ${service.serviceName} (queue size: ${resolveQueue.size})")
    }
    processResolveQueue()
  }

  private fun processResolveQueue() {
    synchronized(resolveQueue) {
      if (isResolving || resolveQueue.isEmpty()) {
        return
      }
      isResolving = true
    }

    val request = synchronized(resolveQueue) { resolveQueue.poll() } ?: run {
      synchronized(resolveQueue) { isResolving = false }
      return
    }

    Log.d(NAME, "Resolving service: ${request.service.serviceName} (attempt ${request.retryCount + 1})")

    try {
      nsdManager.resolveService(request.service, object : NsdManager.ResolveListener {
        override fun onServiceResolved(serviceInfo: NsdServiceInfo) {
          try {
            val serviceKey = serviceKey(serviceInfo)
            synchronized(resolveQueue) {
              pendingServices.remove(serviceKey)
            }
            if (discoveryListeners.containsKey(normalizeType(serviceInfo.serviceType))) {
              resolvedServices[serviceKey] = serviceInfo
              sendEvent(SERVICE_FOUND, serviceToMap(serviceInfo))
              Log.d(NAME, "Resolved service: ${serviceInfo.serviceName}")
            }
          } catch (e: Exception) {
            Log.e(NAME, "Error handling resolved service", e)
          } finally {
            synchronized(resolveQueue) { isResolving = false }
            // Small delay before processing next to avoid overwhelming NsdManager
            mainHandler.postDelayed({ processResolveQueue() }, 50)
          }
        }

        override fun onResolveFailed(serviceInfo: NsdServiceInfo, errorCode: Int) {
          Log.e(NAME, "Resolve failed for ${serviceInfo.serviceName}: errorCode=$errorCode")

          val serviceKey = serviceKey(serviceInfo)

          // Retry on FAILURE_ALREADY_ACTIVE (3) or other transient errors
          if (!discoveryListeners.containsKey(normalizeType(serviceInfo.serviceType))) {
            synchronized(resolveQueue) {
              pendingServices.remove(serviceKey)
            }
          } else if (request.retryCount < MAX_RETRY_COUNT) {
            request.retryCount++
            synchronized(resolveQueue) {
              resolveQueue.add(request) // Re-queue for retry
            }
            Log.d(NAME, "Re-queued ${serviceInfo.serviceName} for retry (attempt ${request.retryCount})")
          } else {
            synchronized(resolveQueue) {
              pendingServices.remove(serviceKey)
            }
            Log.e(NAME, "Giving up on ${serviceInfo.serviceName} after ${MAX_RETRY_COUNT} retries")
          }

          synchronized(resolveQueue) { isResolving = false }
          // Longer delay after failure before retrying
          mainHandler.postDelayed({ processResolveQueue() }, RETRY_DELAY_MS)
        }
      })
    } catch (e: Exception) {
      Log.e(NAME, "Exception starting resolve", e)
      synchronized(resolveQueue) { isResolving = false }
      mainHandler.postDelayed({ processResolveQueue() }, RETRY_DELAY_MS)
    }
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
            Log.d(NAME, "Discovery started for $regType")
          }

          override fun onDiscoveryStopped(regType: String) {
            Log.d(NAME, "Discovery stopped for $regType")
          }

          override fun onServiceFound(service: NsdServiceInfo) {
            try {
              // Service discovery success
              if (isOfType(service, serviceType)) {
                // Queue the service for resolution instead of resolving immediately
                queueServiceForResolve(service)
              }
            } catch (e: Exception) {
              Log.e(NAME, "Error queuing service for resolve", e)
            }
          }

          override fun onServiceLost(serviceInfo: NsdServiceInfo) {
            try {
              // Service lost
              val service = resolvedServices.remove(serviceKey(serviceInfo))
              if (service != null) {
                sendEvent(SERVICE_LOST, serviceToMap(service))
              } else {
                // Send unresolved service in case it was lost before it was resolved
                sendEvent(SERVICE_LOST, serviceToMap(serviceInfo))
              }
            } catch (e: Exception) {
              Log.e(NAME, "Error handling service lost", e)
            }
          }

          override fun onStartDiscoveryFailed(serviceType: String, errorCode: Int) {
            Log.e(NAME, "Discovery start failed: $errorCode")
            tryStopServiceDiscovery(this)
          }

          override fun onStopDiscoveryFailed(serviceType: String, errorCode: Int) {
            Log.e(NAME, "Discovery stop failed: $errorCode")
            tryStopServiceDiscovery(this)
          }
        }
      discoveryListeners[serviceType] = discoveryListener

      nsdManager.discoverServices(serviceType, NsdManager.PROTOCOL_DNS_SD, discoveryListener)
      promise.resolve(null)
      return
    } catch (e: Exception) {
      Log.e(NAME, "Error starting search", e)
      promise.reject(e)
    }
  }

  @ReactMethod
  override fun stopSearch(type: String, promise: Promise) {
    try {
      val serviceType = getServiceType(type)
      resolvedServices.values.removeAll { isOfType(it, serviceType) }
      synchronized(resolveQueue) {
        resolveQueue.removeAll { isOfType(it.service, serviceType) }
        pendingServices.removeAll { it.endsWith("-$serviceType") }
      }

      val discoveryListener = discoveryListeners.remove(serviceType)
      if (discoveryListener != null) {
        tryStopServiceDiscovery(discoveryListener)
      }

      promise.resolve(null)
    } catch (e: Exception) {
      Log.e(NAME, "Error stopping search", e)
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

  // Keyed on the normalized type, see normalizeType.
  private fun serviceKey(service: NsdServiceInfo): String {
    return "${service.serviceName}-${normalizeType(service.serviceType)}"
  }

  // AOSP NsdService delivers the type in two forms on every Android version:
  // found and lost as `_http._tcp.`, resolved as `._http._tcp`.
  // Always compare and key on this canonical form `_http._tcp.`.
  private fun normalizeType(type: String): String {
    return type.removePrefix(".").removeSuffix(".") + "."
  }

  private fun isOfType(service: NsdServiceInfo, serviceType: String): Boolean {
    return normalizeType(service.serviceType) == serviceType
  }

  private fun getServiceType(type: String): String {
    return String.format("_%s._tcp.", type)
  }

  // NsdServiceInfo.getHostname() exists from API 36 and is called by reflection so that the module
  // compiles against older SDKs. canonicalHostName returns the IP when reverse DNS fails.
  private fun getHostName(serviceInfo: NsdServiceInfo): String? {
    if (Build.VERSION.SDK_INT >= 36) {
      try {
        val hostname = NsdServiceInfo::class.java.getMethod("getHostname").invoke(serviceInfo) as? String
        if (!hostname.isNullOrEmpty()) {
          return hostname
        }
      } catch (e: ReflectiveOperationException) {
        Log.w(NAME, "Could not read the service hostname", e)
      }
    }
    return serviceInfo.host?.canonicalHostName
  }

  private fun serviceToMap(serviceInfo: NsdServiceInfo): WritableMap {
    val service: WritableMap = WritableNativeMap()
    try {
      service.putString("name", serviceInfo.serviceName)
      service.putString("type", normalizeType(serviceInfo.serviceType))
      service.putString("domain", "local.")
      service.putInt("port", serviceInfo.port)

      val host = serviceInfo.host
      service.putString("hostName", getHostName(serviceInfo))
      if (host != null) {
        service.putArray("addresses", WritableNativeArray().apply {
          pushString(host.hostAddress)
        })
      } else {
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
      Log.e(NAME, "Error converting service to map", e)
    }
    return service
  }
}
