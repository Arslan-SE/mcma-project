/* NAT server */
resource "aws_instance" "nat" {
  ami               = "${lookup(var.amis, var.aws_region)}"
  instance_type     = "${var.aws_instance_type}"
  subnet_id         = "${aws_subnet.public.id}"
  security_groups   = ["${aws_security_group.default.id}", "${aws_security_group.nat.id}"]
  key_name          = "${aws_key_pair.deployer.key_name}"
  source_dest_check = false

  tags = {
    Name = "nat"
  }

  connection {
    user        = "ubuntu"
    private_key = "${file("ec2/ssh/deployer-key.pem")}"
  }

  provisioner "remote-exec" {
    inline = [
      "sudo iptables -t nat -A POSTROUTING -j MASQUERADE",
      "echo 1 | sudo tee /proc/sys/net/ipv4/conf/all/forwarding > /dev/null",
    ]
  }
}