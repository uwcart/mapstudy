<?PHP

ini_set('display_errors', 1);
require('PHPMailer/PHPMailerAutoload.php');
require('../config/param.php');

$post_data = file_get_contents("php://input");
$post_data = json_decode($post_data, TRUE);

//insert data into database if used
if (isset($dbtype, $dbhost, $dbport, $dbname, $dbuser, $dbpassword)){
	if ($dbtype == 'pgsql'){
		//test db credentials
		try {
			$dbh = new PDO("pgsql:host=$dbhost port=$dbport dbname=$dbname", $dbuser, $dbpassword);
			$dbh->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
		} catch (PDOException $e) {
			echo 'Error: ' . $e->getMessage();
		}

		function makeParticipantTable($dbh, $pid){
			//create participant data table if it doesn't exist
			$sql = "CREATE TABLE IF NOT EXISTS p".$pid."_data (label text primary key, question text, answer text, timestp text);";
			try {
				$stmt = $dbh->prepare($sql);
				$stmt->execute();
			} catch (PDOException $e) {
				echo 'SQL Query: ', $sql;
				echo 'Error: ' . $e->getMessage();
			}
		}

		function makeBigTable($dbh, $tname, $cols){
			$cols = implode(' text, ', $cols);
			//create data table if it doesn't exist
			$sql = "CREATE TABLE IF NOT EXISTS $tname (pid integer primary key, lastupdate timestamp, $cols text);";
			try {
				$stmt = $dbh->prepare($sql);
				$stmt->execute();
			} catch (PDOException $e) {
				echo 'SQL Query: ', $sql;
				echo 'Error: ' . $e->getMessage();
			}
		}

		function addBigTableData($dbh, $pid, $tn, $cs, $ps, $vs){
			//add row for participant if needed
			$sql = "INSERT INTO $tn (pid) SELECT :pid WHERE NOT EXISTS ".
				"(SELECT pid FROM $tn WHERE pid = :pid);";
			try {
				$stmt = $dbh->prepare($sql);
				$stmt->bindParam(':pid', $pid);
				$stmt->execute();
			} catch (PDOException $e) {
				echo 'SQL Query: ', $sql;
				echo 'Error: ' . $e->getMessage();
			}
			//turn arrays into strings
			$cs = implode(", ", $cs);
			$ps = implode(", ", $ps);
			$vs["pid"] = $pid;
			//add data to data table
			$sql = "UPDATE $tn SET ($cs) = ($ps) WHERE pid = :pid;";
			try {
				$stmt = $dbh->prepare($sql);
				$stmt->execute($vs);
			} catch (PDOException $e) {
				echo 'SQL Query: ', $sql;
				echo 'Error: ' . $e->getMessage();
			}
		}

		function makeTables($dbh, $data){
			$pages = $data["pages"];
			$cols = array();
			foreach($pages as $p => $page){
				$pageCols = array();
				$sets = $page["sets"];
				foreach($sets as $s => $set){
					$blocks = $set["blocks"];
					foreach($blocks as $b => $block){
						if (isset($block["input"])){
							$blockLabel = isset($block["label"]) ? $block["label"] : 'p'.(string)($p+1).'s'.(string)($s+1).'b'.(string)($b+1);
							$input = $block["input"];
							if (isset($input["items"])){
								$items = $input["items"];
								foreach($items as $i => $item){
									if (isset($item["label"])){
										$itemLabel = $item["label"];
									} else {
										$itemLabel = $blockLabel.'i'.(string)($i+1);
									}
									$pageCols[] = $itemLabel;
									$cols[] = $itemLabel;
									$pageCols[] = $itemLabel.'_time';
									$cols[] = $itemLabel.'_time';
								}
							} else {
								$pageCols[] = $blockLabel;
								$cols[] = $blockLabel;
								$pageCols[] = $blockLabel.'_time';
								$cols[] = $blockLabel.'_time';
							}
						}
					}
				}
				if (!empty($pageCols)){
					makeBigTable($dbh, 'data_page_'.(string)($p+1), $pageCols);
				}
			}
			if (!empty($cols)){
				makeBigTable($dbh, 'data_master', $cols);
			}
		}

		function updateTables($dbh, $data){
			//set program-defined variables
			$pid = $data["pid"]["value"];
			$updatetime = $data["updatetime"]["value"];
			//create participant table
			makeParticipantTable($dbh, $pid);
			//set arrays for big table columns and values
			$columns = array(
				0 => "lastupdate"
			);
			$placeholders = array(
				0 => ":lastupdate"
			);
			$values = array(
				"lastupdate" => $updatetime
			);
			$asks = array();
			$page = -1;
			$pages = array();
			$pageArray = array();
			foreach($data as $key => $block){
				if ($key != "action" && $block["name"] != 'pid' && $block["name"] != 'updatetime'){
					//set page
					if ($block["page"] > $page){
						$page = $block["page"];
						$pageArray = array();
						$pageArray["columns"] = array(
							0 => "lastupdate"
						);
						$pageArray["placeholders"] = array(
							0 => ":lastupdate"
						);
						$pageArray["values"] = array(
							"lastupdate" => $updatetime
						);
					}
					//set array values
					$column = $block["name"];
					$text = $block["ask"];
					$value = empty($block["value"]) ? null : $block["value"];
					$tmsp = $block["tmsp"];
					$columns[] = $column;
					$columns[] = $column."_time";
					$pageArray["columns"][] = $column;
					$pageArray["columns"][] = $column."_time";
					$placeholders[] = ":".$column;
					$placeholders[] = ":".$column."_time";
					$pageArray["placeholders"][] = ":".$column;
					$pageArray["placeholders"][] = ":".$column."_time";
					$values[$column] = $value;
					$values[$column."_time"] = $tmsp;
					$pageArray["values"][$column] = $value;
					$pageArray["values"][$column."_time"] = $tmsp;
					$pages[$page] = $pageArray;

					//add row for question if needed
					$sql = "INSERT INTO p".$pid."_data SELECT :label WHERE NOT EXISTS ".
						"(SELECT label FROM p".$pid."_data WHERE label = :label);";
					try {
						$stmt = $dbh->prepare($sql);
						$stmt->bindParam(':label', $column);
						$stmt->execute();
					} catch (PDOException $e) {
						echo 'SQL Query: ', $sql;
						echo 'Error: ' . $e->getMessage();
					}

					//insert data into participant data table
					$sql = "UPDATE p".$pid."_data SET (question, answer, timestp) = (:question, :answer, :tmsp) WHERE label = :label;";
					try {
						$stmt = $dbh->prepare($sql);
						$stmt->bindParam(':label', $column);
						$stmt->bindParam(':question', $text);
						$stmt->bindParam(':answer', $value);
						$stmt->bindParam(':tmsp', $tmsp);
						$stmt->execute();
					} catch (PDOException $e) {
						echo 'SQL Query: ', $sql;
						echo 'Error: ' . $e->getMessage();
					}
				}
			}

			//insert data into master data table
			addBigTableData($dbh, $pid, 'data_master', $columns, $placeholders, $values);

			//insert data into page tables
			foreach($pages as $p => $page){
				addBigTableData($dbh, $pid, 'data_page_'.$p, $page["columns"], $page["placeholders"], $page["values"]);
			}
		}

		if (isset($post_data["pages"])){
			makeTables($dbh, $post_data);
		} else {
			updateTables($dbh, $post_data);
		}
	}
}

//e-mail data if e-mail is set up
if (isset($smtphost, $smtpport, $euser, $epass, $toaddr, $subject, $message) && $post_data["action"] == "submit"){
	//WRITE FILE
	//variables of great social and political import
	$pid = $post_data["pid"]["value"];
	$updatetime = $post_data["updatetime"]["value"];
	//column headers
	$csv = "label, question, answer, timestp\n";
	//add rows
	foreach($post_data as $key => $block){
		if ($key != "action" && $key != "pid" && $key != "updatetime"){
			$csv = $csv . 
				$block["name"] . ", " .
				$block["ask"] . ", " .
				$block["value"] . ", " .
				$block["tmsp"] . "\n";
		}
	}
	//check for participants directory and create if not exists
	if (!file_exists("../participants")){
		mkdir("../participants", 0777, true);
	}
	//write it!
	$filepath = "../participants/p".$pid."_data.csv";
	$file = fopen($filepath, "w") or die("Can't open file!");
	fwrite($file, $csv);
	fclose($file);

	//SEND E-MAIL
	//path to participant interactions file
	$ipath = "../participants/p".$pid."_interactions.csv";
	//name of MapStudy app directory
	$appdir = ucfirst(array_pop(explode('\\', dirname(getcwd()))));
	echo $appdir;
	//use PHPMailer class to build e-mail
	$mail = new PHPMailer;
	$mail->SMTPDebug = 3;
	$mail->isSMTP();
	$mail->Host = $smtphost;
	$mail->SMTPAuth = true;
	$mail->Username = $euser;
	$mail->Password = $epass;
	$mail->SMTPSecure = 'tls';
	$mail->Port = $smtpport;
	$mail->setFrom($euser, $appdir . ' MapStudy Application');
	$mail->addAddress($toaddr);
	$mail->addAttachment($filepath);
	if (file_exists($ipath)){
		$mail->addAttachment($ipath);
	}
	$mail->isHTML(true);
	$mail->Subject = $subject;
	$mail->Body = $message;
	//send e-mail
	if(!$mail->send()){
		echo 'Mailer error: ' . $mail->ErrorInfo;
	}
}

?>