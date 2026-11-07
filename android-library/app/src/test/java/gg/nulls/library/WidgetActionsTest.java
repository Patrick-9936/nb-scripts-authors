package gg.nulls.library;

import org.junit.Test;
import java.util.HashSet;
import java.util.Set;
import static org.junit.Assert.*;

public class WidgetActionsTest {
    @Test public void widgetRoutesUseExistingActivityActions() {
        assertEquals(4, WidgetActions.count());
        Set<String> actions = new HashSet<>();
        for (int i = 0; i < WidgetActions.count(); i++) actions.add(WidgetActions.actionFor(i));
        assertEquals(Set.of("search", "mine", "favorites", "import"), actions);
    }

    @Test(expected = IllegalArgumentException.class)
    public void widgetRejectsUnknownActionSlot() { WidgetActions.actionFor(4); }
}
