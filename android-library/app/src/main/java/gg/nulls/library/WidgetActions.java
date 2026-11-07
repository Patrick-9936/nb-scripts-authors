package gg.nulls.library;

/** Stable names consumed by MainActivity.handleIncoming for the widget's four actions. */
final class WidgetActions {
    private static final String[] ACTIONS = {"search", "mine", "favorites", "import"};

    private WidgetActions() {}

    static String actionFor(int slot) {
        if (slot < 0 || slot >= ACTIONS.length) throw new IllegalArgumentException("Unknown widget action slot");
        return ACTIONS[slot];
    }

    static int count() { return ACTIONS.length; }
}
