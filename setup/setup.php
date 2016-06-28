<?PHP

mb_internal_encoding("UTF-8");
ini_set('display_errors', 1);

function makeFile($filename, $contents){
	$file = fopen($filename, "w") or die ("Can't open file ".$filename);
	fwrite($file, $contents);
	fclose($file);
}

function previewFiles($data){
	$dirname = uniqid();
	if (!mkdir($dirname)){
		echo "Could not make directory.";
		exit;
	}
	foreach ($data as $filename => $contents){
		if ($filename == 'param'){
			$ext = '.txt';
		} else if ($filename == 'finished' || $filename == 'operation') {
			continue;
		} else {
			$ext = '.json';
		}
		makeFile($dirname.'/'.$filename.$ext, $contents);
	}
	echo $dirname;
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
		} else if ($filename == 'finished' || $filename == 'operation') {
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
	if ($_POST["operation"] == 'zip'){
		makeZipFile($_POST);
	} elseif ($_POST["operation"] == 'viewcode' || $_POST["operation"] == 'preview'){
		previewFiles($_POST);
	}
} elseif (isset($_GET["dirname"])){
	$dirname = $_GET["dirname"];
	downloadZipFile($dirname);
} elseif (isset($_GET["rmdir"])){
	$dirname = $_GET["rmdir"];
	array_map('unlink', glob("$dirname/*.*"));
	rmdir($dirname);
}

?>