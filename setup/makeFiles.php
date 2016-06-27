<?PHP

mb_internal_encoding("UTF-8");
ini_set('display_errors', 1);

function makeFile($filename, $contents){
	$file = fopen($filename, "w") or die ("Can't open file ".$filename);
	fwrite($file, $contents);
	fclose($file);
}

function makeZipFile($data){
	$dirname = uniqid();
	if (!mkdir($dirname)){
		echo "Could not make directory.";
		exit;
	}
	$zippath = $dirname.'/config.zip';
	$zip = new ZipArchive;
	$zip->open($zippath, ZipArchive::CREATE);
	foreach ($data as $filename => $contents){
		if ($filename == 'param'){
			$ext = '.php';
		} else if ($filename == 'finished') {
			continue;
		} else {
			$ext = '.json';
		}
		$zip->addFromString($filename.$ext, $contents);
	}
	$zip->close();
	echo $dirname;
}

function downloadZipFile($dirname){
	//download the file
	$path = $dirname.'/config.zip';
	header('Content-Description: File Transfer');
    header('Content-Type: application/json');
    header('Content-Disposition: attachment; filename="config.zip"');
    header('Expires: 0');
    header('Cache-Control: must-revalidate');
    header('Pragma: public');
    header('Content-Length: ' . filesize($path));
    readfile($path);
    unlink($path);
    rmdir($dirname);
}

if ($_POST){
	makeZipFile($_POST);
} elseif ($dirname = $_GET["dirname"]){
	downloadZipFile($dirname);
}

?>