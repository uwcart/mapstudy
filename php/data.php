<?PHP

$post_data = file_get_contents("php://input");
$post_data = json_decode($post_data, TRUE);

echo var_dump($post_data);

?>