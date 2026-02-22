Output assets/img/gallery/dbsafe-copy-modify-varchar.gif

Set Shell "bash"
Set FontSize 14
Set Width 1200
Set Height 1100
Set Theme "Dracula"
Set TypingSpeed 40ms
Set Padding 20

Type `export DBSAFE_PASSWORD=dbsafe_demo`
Enter
Sleep 500ms

Type `/Users/dani/dbsafe/dbsafe plan -H 127.0.0.1 -P 23306 -u dbsafe -d demo "ALTER TABLE orders MODIFY COLUMN status VARCHAR(100)"`
Enter
Sleep 5s

Screenshot assets/img/gallery/dbsafe-copy-modify-varchar.png
Sleep 1s
