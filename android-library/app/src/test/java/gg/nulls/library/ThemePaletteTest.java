package gg.nulls.library;

import org.junit.Test;
import static org.junit.Assert.*;

public final class ThemePaletteTest {
    @Test public void acceptsSystemAndSixDigitRgbOnly() {
        assertTrue(ThemePalette.isValidAccent("system"));
        assertTrue(ThemePalette.isValidAccent("#12aBef"));
        assertFalse(ThemePalette.isValidAccent("#fff"));
        assertFalse(ThemePalette.isValidAccent("red"));
        assertFalse(ThemePalette.isValidAccent("#12345678"));
        assertFalse(ThemePalette.isValidAccent(null));
    }

    @Test public void rgbHexClampsAndUsesStableUppercaseFormat() {
        assertEquals("#00A0FF", ThemePalette.hex(-2, 160, 300));
    }

    @Test public void chosenForegroundKeepsAccessibleContrastAcrossPalette() {
        for (int color : new int[]{0xff465bd8, 0xffc8952b, 0xff0f7b6c, 0xfff3e54a, 0xff171d2a})
            assertTrue("contrast for " + Integer.toHexString(color), ThemePalette.contrast(ThemePalette.onColor(color), color) >= 4.5);
    }

    @Test public void rgbWidgetCardsKeepTextContrastInBothThemes() {
        int[] accents = {0xff465bd8, 0xffc8952b, 0xff0f7b6c, 0xfff3e54a, 0xfffa4f85, 0xff121212, 0xfffefefe};
        for (int accent : accents) for (boolean dark : new boolean[]{false, true}) {
            int card = ThemePalette.widgetCardColor(accent, dark);
            assertTrue("widget card contrast for " + Integer.toHexString(accent) + " dark=" + dark,
                    ThemePalette.contrast(ThemePalette.onColor(card), card) >= 4.5);
        }
    }
}
