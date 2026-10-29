#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::Manager;
use tauri::menu::{Menu, MenuItem, Submenu};

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            let menu = Menu::default(app.handle())?;
            let inspect = MenuItem::with_id(
                app,
                "inspect",
                "打开开发者工具",
                true,
                Some("CmdOrCtrl+Alt+I"),
            )?;
            let close =
                MenuItem::with_id(app, "close-inspector", "关闭开发者工具", true, None::<&str>)?;
            menu.append(&Submenu::with_items(
                app,
                "调试",
                true,
                &[&inspect, &close],
            )?)?;
            app.set_menu(menu)?;
            Ok(())
        })
        .on_menu_event(|app, event| {
            if let Some(window) = app.get_webview_window("main") {
                match event.id().as_ref() {
                    "inspect" => window.open_devtools(),
                    "close-inspector" => window.close_devtools(),
                    _ => {}
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("failed to run Emoji Layout Lab");
}
