package gg.nulls.library;

import android.content.Context;
import android.content.res.Resources;
import android.os.Build;

/** Safe accent resolution shared by settings UI and Material You fallback. */
final class ThemePalette {
    static final String SYSTEM = "system";
    static final int FALLBACK_LIGHT = 0xff465bd8;
    static final int FALLBACK_DARK = 0xffaebaff;

    private ThemePalette() {}

    static boolean isValidAccent(String value) {
        return SYSTEM.equals(value) || value != null && value.matches("#[0-9a-fA-F]{6}");
    }

    static int resolve(Context context, String value, boolean dark) {
        if (value != null && value.matches("#[0-9a-fA-F]{6}")) {
            try { return 0xff000000 | Integer.parseInt(value.substring(1), 16); } catch (NumberFormatException ignored) { }
        }
        if (SYSTEM.equals(value) && Build.VERSION.SDK_INT >= 31) {
            String tone = dark ? "system_accent1_200" : "system_accent1_600";
            try {
                Resources system = Resources.getSystem();
                int id = system.getIdentifier(tone, "color", "android");
                if (id != 0) return system.getColor(id, null);
            } catch (RuntimeException ignored) { }
        }
        return dark ? FALLBACK_DARK : FALLBACK_LIGHT;
    }

    static String hex(int red, int green, int blue) {
        return String.format(java.util.Locale.ROOT, "#%02X%02X%02X",
                clamp(red), clamp(green), clamp(blue));
    }

    static int onColor(int color) {
        return luminance(color) > 0.179 ? 0xff101114 : 0xffffffff;
    }

    static int widgetCardColor(int accent, boolean dark) {
        int base = dark ? 0xff222b3b : 0xfff9faff;
        return blend(accent, base, 0.18f);
    }

    static int blend(int foreground, int background, float amount) {
        float ratio = Math.max(0f, Math.min(1f, amount));
        int red = Math.round(channel(background, 16) * (1f - ratio) + channel(foreground, 16) * ratio);
        int green = Math.round(channel(background, 8) * (1f - ratio) + channel(foreground, 8) * ratio);
        int blue = Math.round(channel(background, 0) * (1f - ratio) + channel(foreground, 0) * ratio);
        return 0xff000000 | red << 16 | green << 8 | blue;
    }

    static double contrast(int foreground, int background) {
        double first = luminance(foreground), second = luminance(background);
        return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
    }

    private static double luminance(int color) {
        double red = linear(channel(color, 16) / 255.0), green = linear(channel(color, 8) / 255.0), blue = linear(channel(color, 0) / 255.0);
        return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
    }

    private static int channel(int color, int shift) { return (color >>> shift) & 0xff; }

    private static double linear(double value) { return value <= 0.04045 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4); }

    private static int clamp(int value) { return Math.max(0, Math.min(255, value)); }
}
