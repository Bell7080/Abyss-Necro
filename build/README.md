# build/

electron-builder 리소스 폴더. 아이콘이 확정되면 다음을 추가하고 `package.json`의 `build.win`에 `"icon": "build/icon.ico"`를 되살린다.

- `icon.ico` — Windows 앱 아이콘 (1024×1024 PNG 원본에서 변환)

아이콘이 없는 채로 `npm run dist`를 실행하면 electron-builder 기본 아이콘이 사용된다.
