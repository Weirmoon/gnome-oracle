package com.weirmoon.gnomemobile

import android.app.Activity
import android.content.Intent
import android.os.Bundle
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import android.util.Base64
import android.webkit.WebView
import androidx.core.content.FileProvider
import app.tauri.annotation.Command
import app.tauri.annotation.InvokeArg
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.Invoke
import app.tauri.plugin.JSObject
import app.tauri.plugin.Plugin
import java.io.File
import java.security.KeyStore
import java.util.UUID
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

@InvokeArg class SecretArgs { lateinit var id: String; var value: String? = null }
@InvokeArg class ShareArgs { lateinit var path: String; var mime: String = "application/octet-stream" }
@InvokeArg class SpeechArgs { lateinit var text: String; var rate: Double = 1.0; var pitch: Double = 1.0; var volume: Double = 1.0 }

@TauriPlugin
class GnomeMobilePlugin(private val activity: Activity) : Plugin(activity) {
    private val preferences by lazy { activity.getSharedPreferences("oracle_credentials", Activity.MODE_PRIVATE) }
    private var speech: TextToSpeech? = null
    private var speechReady = false
    private val utterances = mutableMapOf<String, Invoke>()

    override fun load(webView: WebView) {
        speech = TextToSpeech(activity) { status -> speechReady = status == TextToSpeech.SUCCESS }
        speech?.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
            override fun onStart(id: String?) {}
            override fun onDone(id: String?) { activity.runOnUiThread { utterances.remove(id)?.resolve() } }
            @Deprecated("Android callback") override fun onError(id: String?) { activity.runOnUiThread { utterances.remove(id)?.reject("Android speech could not play this sentence") } }
        })
    }
    private fun key(): SecretKey {
        val store = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
        val alias = "gnome-oracle-api-keys"
        (store.getKey(alias, null) as? SecretKey)?.let { return it }
        return KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore").apply {
            init(KeyGenParameterSpec.Builder(alias, KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).build())
        }.generateKey()
    }
    @Command fun secretSet(invoke: Invoke) {
        try {
            val args = invoke.parseArgs(SecretArgs::class.java)
            val edit = preferences.edit()
            if (args.value == null) edit.remove(args.id) else {
                val cipher = Cipher.getInstance("AES/GCM/NoPadding").apply { init(Cipher.ENCRYPT_MODE, key()) }
                cipher.updateAAD(args.id.toByteArray(Charsets.UTF_8))
                val encrypted = cipher.iv + cipher.doFinal(args.value!!.toByteArray(Charsets.UTF_8))
                edit.putString(args.id, Base64.encodeToString(encrypted, Base64.NO_WRAP))
            }
            if (!edit.commit()) throw IllegalStateException()
            invoke.resolve()
        } catch (_: Exception) { invoke.reject("Could not store this API key in Android Keystore") }
    }
    @Command fun secretGet(invoke: Invoke) {
        try {
            val args = invoke.parseArgs(SecretArgs::class.java)
            val encrypted = preferences.getString(args.id, null)
            val result = JSObject()
            if (encrypted != null) {
                val bytes = Base64.decode(encrypted, Base64.NO_WRAP)
                val cipher = Cipher.getInstance("AES/GCM/NoPadding").apply { init(Cipher.DECRYPT_MODE, key(), GCMParameterSpec(128, bytes.copyOfRange(0, 12))) }
                cipher.updateAAD(args.id.toByteArray(Charsets.UTF_8))
                result.put("value", String(cipher.doFinal(bytes.copyOfRange(12, bytes.size)), Charsets.UTF_8))
            }
            invoke.resolve(result)
        } catch (_: Exception) { invoke.reject("Could not unlock this API key; save it again in Settings") }
    }
    @Command fun shareFile(invoke: Invoke) {
        try {
            val args = invoke.parseArgs(ShareArgs::class.java)
            val file = File(args.path).canonicalFile
            val directory = File(activity.cacheDir, "shared").canonicalFile
            require(file.parentFile == directory)
            // The Tauri app manifest owns the shared FileProvider. Reuse it here
            // so the plugin does not register a second provider with conflicting
            // authorities when the Android manifest is merged.
            val uri = FileProvider.getUriForFile(activity, "${activity.packageName}.fileprovider", file)
            val intent = Intent(Intent.ACTION_SEND).setType(args.mime).putExtra(Intent.EXTRA_STREAM, uri).addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            activity.startActivity(Intent.createChooser(intent, "Share from Gnome Oracle"))
            invoke.resolve()
        } catch (_: Exception) { invoke.reject("Could not open Android sharing") }
    }
    @Command fun speak(invoke: Invoke) {
        if (!speechReady) { invoke.reject("Android speech is unavailable; enable a text-to-speech engine in device settings"); return }
        val args = invoke.parseArgs(SpeechArgs::class.java)
        val id = UUID.randomUUID().toString()
        speech?.setSpeechRate(args.rate.toFloat().coerceIn(0.5f, 1.6f))
        speech?.setPitch(args.pitch.toFloat().coerceIn(0.5f, 2f))
        val parameters = Bundle().apply { putFloat(TextToSpeech.Engine.KEY_PARAM_VOLUME, args.volume.toFloat().coerceIn(0f, 1f)) }
        utterances[id] = invoke
        if (speech?.speak(args.text, TextToSpeech.QUEUE_ADD, parameters, id) == TextToSpeech.ERROR) utterances.remove(id)?.reject("Android speech could not queue this sentence")
    }
    @Command fun cancelSpeech(invoke: Invoke) {
        speech?.stop()
        utterances.values.forEach { it.resolve() }
        utterances.clear()
        invoke.resolve()
    }
}
