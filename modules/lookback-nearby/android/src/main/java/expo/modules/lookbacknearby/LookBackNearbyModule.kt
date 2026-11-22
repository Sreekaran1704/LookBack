package expo.modules.lookbacknearby

import android.annotation.SuppressLint
import android.bluetooth.BluetoothManager
import android.bluetooth.le.AdvertiseCallback
import android.bluetooth.le.AdvertiseData
import android.bluetooth.le.AdvertiseSettings
import android.bluetooth.le.ScanCallback
import android.bluetooth.le.ScanFilter
import android.bluetooth.le.ScanResult
import android.bluetooth.le.ScanSettings
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.ParcelUuid
import android.provider.Settings
import io.github.expo.modules.v2.ExpoModule
import io.github.expo.modules.v2.JS
import io.github.expo.modules.v2.Module
import io.github.expo.modules.v2.react.androidContext
import io.github.expo.modules.v2.react.currentActivity
import java.util.concurrent.ConcurrentHashMap

/**
 * Nearby people, over Bluetooth Low Energy. A phone with "Left for you" open announces a random 8-byte token (only that:
 * no name, no account); a phone giving a memory listens for those tokens and asks the server whose they are. Nothing is
 * connected or paired: it is all in the advertising packets, so it works between any two phones close enough to hear.
 */
@ExpoModule("LookBackNearby")
@SuppressLint("MissingPermission")
class LookBackNearbyModule : Module() {
  private val bluetooth get() = (androidContext.getSystemService(Context.BLUETOOTH_SERVICE) as BluetoothManager).adapter
  /** Tokens heard, with when they were last heard and how strong (closer = stronger). */
  private val heard = ConcurrentHashMap<String, Pair<Long, Int>>()

  private val advertising = object : AdvertiseCallback() {}
  private val scanning = object : ScanCallback() {
    override fun onScanResult(callbackType: Int, result: ScanResult) = remember(result)
    override fun onBatchScanResults(results: MutableList<ScanResult>) = results.forEach(::remember)
  }

  private fun remember(result: ScanResult) {
    val bytes = result.scanRecord?.getServiceData(SERVICE) ?: return
    if (bytes.size != TOKEN_BYTES) return
    heard[bytes.joinToString("") { "%02x".format(it) }] = System.currentTimeMillis() to result.rssi
  }

  /** This phone has Bluetooth Low Energy and it's switched on. */
  @JS
  fun isReady(): Boolean =
    androidContext.packageManager.hasSystemFeature(PackageManager.FEATURE_BLUETOOTH_LE) && bluetooth?.isEnabled == true

  /** Announce this token (16 hex characters) to phones nearby, until `stopAnnouncing`. */
  @JS
  fun startAnnouncing(token: String) {
    val advertiser = bluetooth?.bluetoothLeAdvertiser ?: return
    advertiser.stopAdvertising(advertising)
    val bytes = token.chunked(2).map { it.toInt(16).toByte() }.toByteArray()
    val settings = AdvertiseSettings.Builder()
      .setAdvertiseMode(AdvertiseSettings.ADVERTISE_MODE_LOW_LATENCY)
      .setTxPowerLevel(AdvertiseSettings.ADVERTISE_TX_POWER_MEDIUM)
      .setConnectable(false)
      .build()
    val data = AdvertiseData.Builder().setIncludeDeviceName(false).addServiceData(SERVICE, bytes).build()
    advertiser.startAdvertising(settings, data, advertising)
  }

  @JS
  fun stopAnnouncing() {
    bluetooth?.bluetoothLeAdvertiser?.stopAdvertising(advertising)
  }

  /** Listen for phones announcing nearby, until `stopListening`. */
  @JS
  fun startListening() {
    val scanner = bluetooth?.bluetoothLeScanner ?: return
    scanner.stopScan(scanning)
    heard.clear()
    val filter = ScanFilter.Builder().setServiceData(SERVICE, ByteArray(0), ByteArray(0)).build()
    val settings = ScanSettings.Builder().setScanMode(ScanSettings.SCAN_MODE_LOW_LATENCY).build()
    scanner.startScan(listOf(filter), settings, scanning)
  }

  @JS
  fun stopListening() {
    bluetooth?.bluetoothLeScanner?.stopScan(scanning)
    heard.clear()
  }

  /** Tokens heard in the last few seconds, closest first. */
  @JS
  fun heardTokens(): List<String> {
    val now = System.currentTimeMillis()
    heard.entries.removeAll { now - it.value.first > FORGET_AFTER_MS }
    return heard.entries.sortedByDescending { it.value.second }.map { it.key }
  }

  /** Opens the phone's Bluetooth settings, to switch it on. */
  @JS
  fun openSettings() {
    val intent = Intent(Settings.ACTION_BLUETOOTH_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    (currentActivity ?: androidContext).startActivity(intent)
  }

  companion object {
    /** LookBack's service id in the advertising packet (a 16-bit id keeps the packet small enough for the token). */
    private val SERVICE: ParcelUuid = ParcelUuid.fromString("0000b10b-0000-1000-8000-00805f9b34fb")
    private const val TOKEN_BYTES = 8
    /** A phone not heard for this long has walked away (or closed the page). */
    private const val FORGET_AFTER_MS = 6000L
  }
}
