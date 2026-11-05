param([string]$ProjectRoot=(Split-Path (Split-Path $PSScriptRoot -Parent) -Parent))
$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Drawing
$out=Join-Path $ProjectRoot 'figures\web_geometry'
$ref=Join-Path $ProjectRoot 'references\exterior'
# Original reference photographs remain outside web/public and GitHub.
# Use complete frames so the source watermark is retained.
$pairs=@(
  @('front45','neo_13402347.jpg','前 45°'),
  @('side','neo_13402344.jpg','正侧方'),
  @('rear45','neo_13402343.jpg','后 45°'),
  @('front','neo_13402346.jpg','正前方'),
  @('rear','neo_13402342.jpg','正后方')
)
$font=[Drawing.Font]::new('Microsoft YaHei',30)
$small=[Drawing.Font]::new('Microsoft YaHei',20)
$brush=[Drawing.SolidBrush]::new([Drawing.Color]::FromArgb(30,48,43))
foreach($pair in $pairs){
  $canvas=[Drawing.Bitmap]::new(3200,1400)
  $g=[Drawing.Graphics]::FromImage($canvas)
  $g.Clear([Drawing.Color]::White)
  $g.InterpolationMode=[Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.DrawString(('Neo 实车与原创 WebGL 外观对照 · '+$pair[2]),$font,$brush,60,35)
  $g.DrawString('左：汽车之家 2026 款 Neo 实拍，完整原始画面',$small,$brush,60,105)
  $g.DrawString('右：独立参数化模型，Three.js 实际渲染',$small,$brush,1640,105)
  $photo=[Drawing.Image]::FromFile((Join-Path $ref $pair[1]))
  $render=[Drawing.Image]::FromFile((Join-Path $out ($pair[0]+'.png')))
  $g.DrawImage($photo,60,175,1480,1110)
  $g.DrawImage($render,1640,314,1480,833)
  $g.DrawString('本图仅供本地外形比对；照片未获重分发许可，不随公开网页发布。相机透视未标定。',$small,$brush,60,1320)
  $canvas.Save((Join-Path $out ('compare_'+$pair[0]+'.png')),[Drawing.Imaging.ImageFormat]::Png)
  $render.Dispose();$photo.Dispose();$g.Dispose();$canvas.Dispose()
}
$font.Dispose();$small.Dispose();$brush.Dispose()
Write-Output "Saved five local-only comparisons to $out"
